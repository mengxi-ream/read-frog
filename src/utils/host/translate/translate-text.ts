import type { LangCodeISO6393, LangLevel } from "@read-frog/definitions"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { TranslationTextFormat } from "@/types/config/translate"
import type { WebPagePromptContext } from "@/types/content"
import type { SerializableProviderRef, UnwrappedProviderRef } from "@/utils/providers/provider-ref"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { toastManager } from "@/components/ui/base-ui/toast"
import { isAPIProviderConfig, isLLMProviderConfig } from "@/types/config/provider"
import { isNoTranslationSentinel } from "@/utils/constants/prompt"
import { detectLanguage } from "@/utils/content/language"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { isSystemProviderRef, serializeProviderRef } from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { TranslationCancelledError } from "@/utils/request/cancellation"
import { Sha256Hex } from "../../hash"
import { sendMessage } from "../../message"
import { getInMemoryTranslation, storeInMemoryTranslation } from "./in-memory-translation-cache"
import { prepareTranslationText } from "./text-preparation"
import {
  getPageTranslationSessionId,
  getPageTranslationSessionProviderRef,
  setPageTranslationSessionProviderRef,
} from "./translation-session"

/**
 * Minimum text length before a skip decision is attempted at all. Deliberately
 * below the general threshold, to catch short phrases like "Bonjour!" or
 * "こんにちは".
 *
 * Left at 10 even though detection is now franc-only. Raising it looks right
 * for Latin script — franc on ten characters is close to a coin flip there —
 * but this counts characters, and ten characters of Han, kana or Hangul is
 * plenty for franc precisely because the script alone is near-decisive. A flat
 * character count cannot express that difference, so tuning it needs a
 * script-aware rule rather than a bigger number.
 */
export const MIN_LENGTH_FOR_SKIP_LANGUAGE_DETECTION = 10

/**
 * Check if text should be skipped based on language detection.
 *
 * Deliberately franc-only. This runs once per paragraph, so routing it through
 * an LLM cost one hosted call per paragraph — hundreds per article, against the
 * same weekly pool that funds page translation and subtitles, and against a
 * BYOK user's own budget. The whole-page source language is detected once and
 * cached; this second, uncached, per-paragraph pass existed only for pages that
 * mix languages, and the value of a right answer here (avoid one redundant
 * translation) never justified the per-paragraph price of getting it.
 *
 * `languageDetection.mode` still governs the once-per-page source detection,
 * where a wrong answer corrupts the prompt for every paragraph.
 */
export async function shouldSkipByLanguage(
  text: string,
  skipLanguages: LangCodeISO6393[],
): Promise<boolean> {
  const detectedLang = await detectLanguage(text, {
    minLength: MIN_LENGTH_FOR_SKIP_LANGUAGE_DETECTION,
    enableLLM: false,
  })

  if (!detectedLang) {
    return false
  }

  return skipLanguages.includes(detectedLang)
}

export function normalizePromptContextValue(
  value: string | null | undefined,
): string | null | undefined {
  if (value === null || value === undefined) {
    return value
  }
  return value.trim() === "" ? null : value
}

function normalizeWebPagePromptContext(
  webPageContext?: WebPagePromptContext,
): WebPagePromptContext | undefined {
  if (!webPageContext) {
    return undefined
  }

  return {
    webTitle: normalizePromptContextValue(webPageContext.webTitle),
    webDescription: normalizePromptContextValue(webPageContext.webDescription),
    webContent: normalizePromptContextValue(webPageContext.webContent),
    webSummary: normalizePromptContextValue(webPageContext.webSummary),
  }
}

async function buildWebPageHashComponents(
  text: string,
  providerRef: SerializableProviderRef,
  partialLangConfig: { sourceCode: LangCodeISO6393 | "auto"; targetCode: LangCodeISO6393 },
  enableAIContentAware: boolean,
  textFormat: TranslationTextFormat,
  preserveLineBreaks: boolean,
  webPageContext?: WebPagePromptContext,
): Promise<string[]> {
  const preparedText = prepareTranslationText(text)
  const normalizedWebPageContext = normalizeWebPagePromptContext(webPageContext)
  const providerConfig = providerRef.kind === "local" ? providerRef.config : null
  const providerHashIdentity =
    providerRef.kind === "local"
      ? providerRef.config
      : {
          providerId: providerRef.providerId,
          modelRevision: providerRef.modelRevision,
        }
  const hashComponents = [
    preparedText,
    JSON.stringify(providerHashIdentity),
    partialLangConfig.sourceCode,
    partialLangConfig.targetCode,
  ]

  if (providerConfig && !isLLMProviderConfig(providerConfig)) {
    // The provider request depends on the text format (escaping / textType), so
    // cache entries must too. This component also orphans entries cached before
    // the format-aware pipeline existed, which could hold corrupted output.
    hashComponents.push(`textFormat:${textFormat}`)
    // Pushed only when the flag actually changes the provider request —
    // today that is Google alone — so cache entries written before the flag
    // existed stay valid and identical Microsoft/DeepL requests are not
    // fragmented. Flagged Google requests get fresh entries (any old
    // collapsed-line output for the same text is orphaned rather than
    // reused).
    if (preserveLineBreaks && providerConfig.provider === "google-translate") {
      hashComponents.push("preserveLineBreaks:true")
    }
    return hashComponents
  }

  const targetLangName = LANG_CODE_TO_EN_NAME[partialLangConfig.targetCode]
  const { systemPrompt, prompt } = await getTranslatePrompt(targetLangName, preparedText, {
    isBatch: true,
    context: normalizedWebPageContext,
  })
  hashComponents.push(systemPrompt, prompt)
  hashComponents.push(
    enableAIContentAware ? "enableAIContentAware=true" : "enableAIContentAware=false",
  )

  if (enableAIContentAware && normalizedWebPageContext) {
    if (normalizedWebPageContext.webTitle) {
      hashComponents.push(`webTitle:${normalizedWebPageContext.webTitle}`)
    }
    if (normalizedWebPageContext.webDescription) {
      hashComponents.push(`webDescription:${normalizedWebPageContext.webDescription}`)
    }
    if (normalizedWebPageContext.webContent) {
      // Use a substring hash to avoid huge hash inputs while still differentiating contexts.
      hashComponents.push(`webContent:${normalizedWebPageContext.webContent.slice(0, 1000)}`)
    }
    if (normalizedWebPageContext.webSummary) {
      hashComponents.push(`webSummary:${normalizedWebPageContext.webSummary}`)
    }
  }

  return hashComponents
}

/**
 * Reuse the session's resolved system-provider ref when it matches the
 * requested provider, so every paragraph of a page-translation session runs
 * on one status snapshot: no per-paragraph status fetches, and a mid-session
 * status blip cannot fail in-flight paragraphs.
 */
function getSessionProviderRefFor(provider: UnwrappedProviderRef): SerializableProviderRef | null {
  if (!isSystemProviderRef(provider)) {
    return null
  }
  const sessionRef = getPageTranslationSessionProviderRef()
  if (
    sessionRef?.kind !== "system" ||
    sessionRef.providerId !== provider.id ||
    sessionRef.modelTier !== provider.modelTier
  ) {
    return null
  }
  return sessionRef
}

const pendingSystemSerializes = new Map<string, Promise<SerializableProviderRef>>()
/**
 * Most recently requested system-provider key. Stale stragglers — paragraphs
 * that captured the previous provider from config before a mid-session switch
 * and resolve late — must not adopt their ref back over the snapshot the
 * newer paragraphs converged on, which would evict it and force refetch
 * ping-pong.
 */
let lastRequestedSystemKey: string | null = null

/**
 * Resolve the transport ref for the requested provider. Snapshot misses do
 * happen off the happy path — a mid-session provider/tier switch, node
 * translation without an active session — and each translation unit resolves
 * independently, so without coalescing a dense batch would fan out one
 * hosted-status fetch per paragraph. Concurrent misses for the same system
 * provider share one serialization (per-key, so interleaved keys cannot evict
 * each other's in-flight fetch), and an active session adopts the result so
 * later paragraphs skip the network entirely.
 */
export async function resolvePageProviderRef(
  provider: UnwrappedProviderRef,
  sessionId: string | undefined,
  feature: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef> {
  if (!isSystemProviderRef(provider)) {
    return serializeProviderRef(provider, feature)
  }

  // The feature is part of the key: two features on the same provider and tier
  // gate on different tier statuses, so they must not share an in-flight fetch.
  const key = `${provider.id}:${provider.modelTier}:${feature}`
  lastRequestedSystemKey = key

  // The session snapshot belongs to the page-translation run; other features
  // must not adopt it, and must not overwrite it below.
  const sessionRef = feature === "pageTranslation" ? getSessionProviderRefFor(provider) : null
  if (sessionRef) {
    return sessionRef
  }

  let promise = pendingSystemSerializes.get(key)
  if (!promise) {
    const created = serializeProviderRef(provider, feature)
    promise = created
    pendingSystemSerializes.set(key, created)
    void created
      .catch(() => undefined)
      .finally(() => {
        if (pendingSystemSerializes.get(key) === created) {
          pendingSystemSerializes.delete(key)
        }
      })
  }

  const providerRef = await promise
  if (
    feature === "pageTranslation" &&
    sessionId !== undefined &&
    getPageTranslationSessionId() === sessionId &&
    key === lastRequestedSystemKey
  ) {
    setPageTranslationSessionProviderRef(providerRef)
  }
  return providerRef
}

export interface TranslateTextOptions {
  text: string
  langConfig: {
    sourceCode: LangCodeISO6393 | "auto"
    targetCode: LangCodeISO6393
    level: LangLevel
  }
  providerConfig: UnwrappedProviderRef
  enableAIContentAware?: boolean
  extraHashTags?: string[]
  webPageContext?: WebPagePromptContext
  textFormat?: TranslationTextFormat
  // Source line breaks are semantic — see the enqueueTranslateRequest field.
  preserveLineBreaks?: boolean
  // Page-translation session id used for cancellation scoping. Deliberately
  // NOT part of the cache hash — cache identity must not vary per session.
  sessionId?: string
  forceRetranslation?: boolean
  /**
   * Which hosted route a system provider bills against; local providers
   * ignore it. Required so every entry point states its route where the
   * function is named — a defaulted route once let page translation gate on
   * and bill against the wrong quota.
   */
  hostedFeature: HostedAiTextStreamRoute
}

/**
 * Core translation function — pure, zero config fetching.
 * All dependencies must be provided explicitly.
 */
export async function translateTextCore(options: TranslateTextOptions): Promise<string> {
  const {
    text,
    langConfig,
    providerConfig,
    enableAIContentAware = false,
    extraHashTags = [],
    webPageContext,
    textFormat = "plain",
    preserveLineBreaks = false,
    sessionId,
    forceRetranslation = false,
    hostedFeature,
  } = options

  const preparedText = prepareTranslationText(text)
  if (preparedText === "") {
    return ""
  }

  // Early cancellation gate: a session stopped while this paragraph was still
  // preparing must not fire a post-cancel hosted-status fetch below just to
  // throw at the final gate.
  if (sessionId !== undefined && getPageTranslationSessionId() !== sessionId) {
    throw new TranslationCancelledError(sessionId)
  }

  const normalizedWebPageContext = normalizeWebPagePromptContext(webPageContext)
  const providerRef = await resolvePageProviderRef(providerConfig, sessionId, hostedFeature)

  const hashComponents = await buildWebPageHashComponents(
    preparedText,
    providerRef,
    { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode },
    enableAIContentAware,
    textFormat,
    preserveLineBreaks,
    normalizedWebPageContext,
  )

  // Add extra hash tags for cache differentiation
  hashComponents.push(...extraHashTags)

  // Final gate before dispatch: if the page-translation session that owned
  // this request has ended (or been replaced) while we were preparing it,
  // abort instead of enqueueing. Sending now would either be unscoped (if the
  // id had gone null) or re-populate the queue AFTER the session's cancel
  // message already drained it — both defeat cancellation (#1881). Callers on
  // the page path swallow this error; input/selection requests carry no
  // sessionId and skip the gate entirely. The gate must also precede the
  // memory-tier read below: a cancelled session must not keep painting
  // translations out of memory.
  if (sessionId !== undefined && getPageTranslationSessionId() !== sessionId) {
    throw new TranslationCancelledError(sessionId)
  }

  const hash = Sha256Hex(...hashComponents)

  // In-tab memory tier over the background cache, same hash identity.
  // Virtualized pages (X articles/timelines) destroy and recreate paragraph
  // nodes on scroll; the recreated nodes re-enter this pipeline for text the
  // tab already translated, and paying the message round trip again makes the
  // page visibly re-translate paragraph by paragraph. Scoped to
  // page-translation runs (sessionId) so input/selection behavior is
  // untouched; forceRetranslation bypasses the read exactly like it bypasses
  // the background cache, but its fresh result still lands in the store below.
  if (sessionId !== undefined && !forceRetranslation) {
    const memoryHit = getInMemoryTranslation(hash)
    if (memoryHit !== undefined) {
      return isNoTranslationSentinel(memoryHit) ? "" : memoryHit
    }
  }

  const result = await sendMessage("enqueueTranslateRequest", {
    text: preparedText,
    langConfig,
    providerRef,
    scheduleAt: Date.now(),
    hash,
    textFormat,
    preserveLineBreaks,
    webTitle: normalizedWebPageContext?.webTitle,
    webDescription: normalizedWebPageContext?.webDescription,
    webContent: normalizedWebPageContext?.webContent,
    webSummary: normalizedWebPageContext?.webSummary,
    sessionId,
    forceRetranslation,
    hostedFeature,
  })
  if (sessionId !== undefined) {
    // Raw result, sentinel included, so a "no translation needed" verdict is
    // remembered too; the mapping below stays the single mapping point.
    storeInMemoryTranslation(hash, result)
  }
  // The sentinel must be mapped here and only here: every batch-pipeline
  // consumer (page paragraphs, document title, input translation, selection
  // toolbar standard path) routes through this function and already handles
  // "" gracefully. Mapping earlier — in the background — would fall out of
  // the truthy-only cache write and re-hit the provider on every request.
  return isNoTranslationSentinel(result) ? "" : result
}

export function validateTranslationConfigAndToast(
  config: Pick<Config, "providersConfig" | "pageTranslation" | "language">,
): boolean {
  const { providersConfig, pageTranslation: translateConfig, language: languageConfig } = config
  const provider = resolveProviderRefForCapability(
    "pageTranslation",
    providersConfig,
    translateConfig.providerId,
  )
  if (!provider) {
    return false
  }

  if (languageConfig.sourceCode === languageConfig.targetCode) {
    toastManager.add({ type: "error", title: i18n.t("translation.sameLanguage") })
    logger.info("validateTranslationConfig: returning false (same language)")
    return false
  }

  // check if the API key is configured
  if (
    provider.kind === "local" &&
    isAPIProviderConfig(provider.config) &&
    !provider.config.apiKey?.trim() &&
    !["deeplx", "ollama"].includes(provider.config.provider)
  ) {
    toastManager.add({ type: "error", title: i18n.t("noAPIKeyConfig.warning") })
    logger.info("validateTranslationConfig: returning false (no API key)")
    return false
  }

  return true
}
