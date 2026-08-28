import type { SubtitlesFragment } from "../types"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { SubtitlePromptContext } from "@/types/content"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { APICallError } from "ai"
import { toastManager } from "@/components/ui/base-ui/toast"
import { isLLMProviderConfig } from "@/types/config/provider"
import { getLocalConfig } from "@/utils/config/storage"
import { cleanText } from "@/utils/content/utils"
import { Sha256Hex } from "@/utils/hash"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import {
  canProviderRefGenerateText,
  getProviderCacheIdentity,
  HostedAiProviderUnavailableError,
  serializeProviderRef,
} from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"

/**
 * One toast for the whole run, not one per batch: the provider is re-resolved
 * per ≤5-cue batch, and every batch of a video hits the same verdict.
 */
const SUBTITLES_HOSTED_UNAVAILABLE_TOAST_ID = "subtitles-hosted-unavailable"

function toFriendlyErrorMessage(error: unknown): string {
  if (error instanceof APICallError) {
    switch (error.statusCode) {
      case 429:
        return i18n.t("subtitles.errors.aiRateLimited")
      case 401:
      case 403:
        return i18n.t("subtitles.errors.aiAuthFailed")
      case 500:
      case 502:
      case 503:
        return i18n.t("subtitles.errors.aiServiceUnavailable")
      default:
        break
    }
  }

  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("No Response") || message.includes("Empty response")) {
    return i18n.t("subtitles.errors.aiNoResponse")
  }

  return message
}

export interface SubtitlesVideoContext {
  videoTitle: string
  videoDescription?: string | null
  subtitlesTextContent: string
  summary?: string | null
}

export function buildSubtitlesSummaryContextHash(
  videoContext: Pick<SubtitlesVideoContext, "subtitlesTextContent">,
  providerRef?: SerializableProviderRef,
): string | undefined {
  const preparedText = cleanText(videoContext.subtitlesTextContent)
  if (!preparedText) {
    return undefined
  }

  const textHash = Sha256Hex(preparedText)
  return Sha256Hex(textHash, providerRef ? getProviderCacheIdentity(providerRef) : "")
}

function normalizeSubtitlePromptContext(
  videoContext: SubtitlesVideoContext,
): SubtitlePromptContext {
  return {
    webTitle: normalizePromptContextValue(videoContext.videoTitle),
    webDescription: normalizePromptContextValue(videoContext.videoDescription),
    videoSummary: normalizePromptContextValue(videoContext.summary),
  }
}

async function buildSubtitleHashComponents(
  text: string,
  providerRef: SerializableProviderRef,
  partialLangConfig: {
    sourceCode: Config["language"]["sourceCode"]
    targetCode: Config["language"]["targetCode"]
  },
  enableAIContentAware: boolean,
  subtitlePromptContext: SubtitlePromptContext,
  subtitlesTextContent: string,
): Promise<string[]> {
  const preparedText = prepareTranslationText(text)
  const normalizedSubtitlesTextContent = normalizePromptContextValue(subtitlesTextContent)
  const hashComponents = [
    preparedText,
    getProviderCacheIdentity(providerRef),
    partialLangConfig.sourceCode,
    partialLangConfig.targetCode,
  ]

  // Pure translate providers take no prompt; Built-in AI does, and so do local
  // LLMs, so both contribute the prompt to the cache key.
  if (providerRef.kind === "local" && !isLLMProviderConfig(providerRef.config)) {
    return hashComponents
  }

  const targetLangName = LANG_CODE_TO_EN_NAME[partialLangConfig.targetCode]
  const promptContext = enableAIContentAware
    ? subtitlePromptContext
    : { ...subtitlePromptContext, videoSummary: undefined }
  const { systemPrompt, prompt } = await getSubtitlesTranslatePrompt(targetLangName, preparedText, {
    isBatch: true,
    context: promptContext,
  })
  hashComponents.push(systemPrompt, prompt)
  hashComponents.push(
    enableAIContentAware ? "enableAIContentAware=true" : "enableAIContentAware=false",
  )

  if (subtitlePromptContext.webTitle) {
    hashComponents.push(`webTitle:${subtitlePromptContext.webTitle}`)
  }
  if (subtitlePromptContext.webDescription) {
    hashComponents.push(`webDescription:${subtitlePromptContext.webDescription}`)
  }
  if (enableAIContentAware) {
    if (normalizedSubtitlesTextContent) {
      hashComponents.push(`subtitlesTextContent:${normalizedSubtitlesTextContent.slice(0, 1000)}`)
    }
    if (subtitlePromptContext.videoSummary) {
      hashComponents.push(`videoSummary:${subtitlePromptContext.videoSummary}`)
    }
  }

  return hashComponents
}

async function translateSingleSubtitle(
  text: string,
  langConfig: Config["language"],
  providerRef: SerializableProviderRef,
  enableAIContentAware: boolean,
  videoContext: SubtitlesVideoContext,
): Promise<string> {
  const subtitlePromptContext = normalizeSubtitlePromptContext(videoContext)
  const hashComponents = await buildSubtitleHashComponents(
    text,
    providerRef,
    { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode },
    enableAIContentAware,
    subtitlePromptContext,
    videoContext.subtitlesTextContent,
  )

  if (enableAIContentAware) {
    const summary = subtitlePromptContext.videoSummary
    hashComponents.push(summary ? "subtitleSummary=ready" : "subtitleSummary=missing")
  }

  return await sendMessage("enqueueSubtitlesTranslateRequest", {
    text,
    langConfig,
    providerRef,
    scheduleAt: Date.now(),
    hash: Sha256Hex(...hashComponents),
    webTitle: subtitlePromptContext.webTitle,
    webDescription: subtitlePromptContext.webDescription,
    summary: enableAIContentAware ? subtitlePromptContext.videoSummary : undefined,
  })
}

export type SubtitlesProviderResolution =
  | { status: "ok"; ref: SerializableProviderRef }
  | { status: "hostedUnavailable"; message: string }
  | { status: "none" }

/** Reports without announcing, so callers can tell a plan/quota refusal from "nothing selected". */
export async function resolveSubtitlesProviderResolution(
  config: Config,
  route: HostedAiTextStreamRoute,
): Promise<SubtitlesProviderResolution> {
  const resolved = resolveProviderRefForCapability(
    "videoSubtitles",
    config.providersConfig,
    config.videoSubtitles.providerId,
  )
  if (!resolved) {
    return { status: "none" }
  }
  try {
    const ref = await serializeProviderRef(
      resolved.kind === "local" ? resolved.config : resolved,
      route,
    )
    return { status: "ok", ref }
  } catch (error) {
    if (error instanceof HostedAiProviderUnavailableError) {
      return { status: "hostedUnavailable", message: error.message }
    }
    // Nothing else is expected to throw here (serializeProviderRef already
    // fails open on an unreachable status endpoint). Keep degrading rather
    // than introducing a new throw into the render path, but leave a trace.
    logger.warn("[Subtitles] Provider ref resolution failed", error)
    return { status: "none" }
  }
}

/**
 * Resolve the subtitles provider into a transportable ref. Capability-based so
 * Built-in AI — never a row in providersConfig — is reachable, and serialized
 * once per call so a whole run makes a single hostedAi.status fetch instead of
 * one per fragment.
 */
export async function resolveSubtitlesProviderRef(
  config: Config,
  route: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef | null> {
  const resolution = await resolveSubtitlesProviderResolution(config, route)
  if (resolution.status === "hostedUnavailable") {
    // Silence here is indistinguishable from "these lines have no translation".
    toastManager.add({
      type: "error",
      title: resolution.message,
      id: SUBTITLES_HOSTED_UNAVAILABLE_TOAST_ID,
    })
    return null
  }
  return resolution.status === "ok" ? resolution.ref : null
}

export async function fetchSubtitlesSummary(
  videoContext: SubtitlesVideoContext,
  configOverride?: Config,
): Promise<string | null> {
  const config = configOverride ?? (await getLocalConfig())
  if (!config?.pageTranslation.enableAIContentAware) {
    return null
  }

  const providerRef = await resolveSubtitlesProviderRef(config, "videoSubtitles")
  // A summary is a generation, but the subtitles provider list is gated on the
  // wider translate capability — so the default Microsoft provider resolves
  // here perfectly well and then cannot be prompted. Bail before the message:
  // the background admits it to the queue, where it throws and burns its
  // retries at the start of every video.
  if (!providerRef || !canProviderRefGenerateText(providerRef)) {
    return null
  }

  if (!videoContext.videoTitle || !videoContext.subtitlesTextContent) {
    return null
  }

  return await sendMessage("getSubtitlesSummary", {
    videoTitle: videoContext.videoTitle,
    subtitlesContext: videoContext.subtitlesTextContent,
    providerRef,
  })
}

export async function translateSubtitles(
  fragments: SubtitlesFragment[],
  videoContext: SubtitlesVideoContext,
  configOverride?: Config,
): Promise<SubtitlesFragment[]> {
  const config = configOverride ?? (await getLocalConfig())
  if (!config) {
    return fragments.map((f) => ({ ...f, translation: "" }))
  }

  const providerRef = await resolveSubtitlesProviderRef(config, "videoSubtitles")
  if (!providerRef) {
    return fragments.map((f) => ({ ...f, translation: "" }))
  }

  const langConfig = config.language
  const enableAIContentAware = config.pageTranslation.enableAIContentAware

  const translationPromises = fragments.map((fragment) =>
    translateSingleSubtitle(
      fragment.text,
      langConfig,
      providerRef,
      enableAIContentAware,
      videoContext,
    ),
  )

  const results = await Promise.allSettled(translationPromises)

  // If all translations failed, throw with friendly error message
  const allRejected = results.every((r): r is PromiseRejectedResult => r.status === "rejected")
  if (allRejected && results.length) {
    throw new Error(toFriendlyErrorMessage(results[0]!.reason))
  }

  return fragments.map((fragment, index) => {
    const result = results[index]
    return {
      ...fragment,
      translation: result!.status === "fulfilled" ? result!.value : "",
    }
  })
}
