import type { SubtitlesFragment } from "../types"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { SubtitlePromptContext } from "@/types/content"
import type { MatchedTerm } from "@/utils/glossary/types"
import type { PromptableProviderRef, SerializableProviderRef } from "@/utils/providers/provider-ref"
import { LANGUAGE_ENGLISH_NAMES } from "@read-frog/definitions"
import { APICallError } from "ai"
import { toastManager } from "@/components/ui/base-ui/toast"
import { isLLMProviderConfig } from "@/types/config/provider"
import { classifySerializedProvider } from "@/utils/analytics-provider"
import { getLocalConfig } from "@/utils/config/storage"
import { cleanText } from "@/utils/content/utils"
import { resolveGlossaryTerms } from "@/utils/glossary/active-matcher"
import { trackGlossaryUsed } from "@/utils/glossary/analytics"
import { Sha256Hex } from "@/utils/hash"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import {
  canResolvedProviderRefGenerateText,
  getProviderCacheIdentity,
  HostedAiProviderUnavailableError,
  serializeProviderRef,
} from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"

const log = createLogger("subtitles/processor/translator")

/**
 * One toast for the whole run, not one per batch: the provider is re-resolved
 * per ≤5-cue batch, and every batch of a video hits the same verdict.
 */
const SUBTITLES_HOSTED_UNAVAILABLE_TOAST_ID = "subtitles-hosted-unavailable"

/**
 * What the resolved provider is being asked to do. Line translation is the
 * capability the provider list is gated on, so any resolved provider can run
 * it; a summary or a recut is a generation, which only a promptable provider
 * can run — the resolution reports that as its own state instead of handing
 * out a ref the task can only throw on.
 */
export type SubtitlesTask = "lineTranslation" | "summary" | "segmentation"

/**
 * Line translation and the summary bill against `videoSubtitles`; segmentation
 * has its own route for the wider output budget, but `getHostedFeatureForRoute`
 * collapses it back onto the same status gate.
 */
const SUBTITLES_TASK_ROUTE: Record<SubtitlesTask, HostedAiTextStreamRoute> = {
  lineTranslation: "videoSubtitles",
  summary: "videoSubtitles",
  segmentation: "videoSubtitlesSegmentation",
}

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

/**
 * Which video a session belongs to, as far as caching is concerned: the
 * transcript itself, hashed the way the background keys the summary
 * (`getSubtitlesSummary`). Unlike the page's title and meta description, it
 * reads the same on every visit.
 */
function getSubtitlesTranscriptIdentity(subtitlesTextContent: string): string | undefined {
  const preparedText = cleanText(subtitlesTextContent)
  return preparedText ? Sha256Hex(preparedText) : undefined
}

export function buildSubtitlesSummaryContextHash(
  videoContext: Pick<SubtitlesVideoContext, "subtitlesTextContent">,
  providerRef?: SerializableProviderRef,
): string | undefined {
  const transcriptIdentity = getSubtitlesTranscriptIdentity(videoContext.subtitlesTextContent)
  if (!transcriptIdentity) {
    return undefined
  }

  return Sha256Hex(transcriptIdentity, providerRef ? getProviderCacheIdentity(providerRef) : "")
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
  subtitlesTextContent: string,
  glossaryTerms: readonly MatchedTerm[],
): Promise<string[]> {
  const preparedText = prepareTranslationText(text)
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

  const targetLangName = LANGUAGE_ENGLISH_NAMES[partialLangConfig.targetCode]
  // Hashed for the template and the glossary only, with the video context left
  // empty. That context is the page title, the meta description and the AI
  // summary, and none of it is stable across visits: the first two are read
  // from a DOM that differs between an in-app navigation and a reload (YouTube
  // keeps the previous page's description until a full load, and its title
  // trails the navigation), and the summary lands after the first cues are
  // already in flight. Keyed on them, rewatching after a refresh missed every
  // cue and paid for the whole video again (#2472). The request still carries
  // the real context; only the key leaves it out. Glossary terms are passed in
  // rather than resolved here, so the prompt this hash is taken over is built
  // from exactly the terms the request will carry.
  const { systemPrompt, prompt } = await getSubtitlesTranslatePrompt(targetLangName, preparedText, {
    isBatch: true,
    context: {},
    glossaryTerms,
  })
  hashComponents.push(systemPrompt, prompt)
  hashComponents.push(
    enableAIContentAware ? "enableAIContentAware=true" : "enableAIContentAware=false",
  )

  // The video, in place of the context above. The summary is a function of
  // the transcript and the provider, both already in the key, so dropping the
  // summary loses nothing a rewatch would need — and it also keeps this key
  // shared with the translated-subtitles download, which builds its context
  // without a description and only after the summary is ready.
  const transcriptIdentity = getSubtitlesTranscriptIdentity(subtitlesTextContent)
  if (transcriptIdentity) {
    hashComponents.push(`transcript:${transcriptIdentity}`)
  }

  return hashComponents
}

async function translateSingleSubtitle(
  text: string,
  langConfig: Config["language"],
  providerRef: SerializableProviderRef,
  enableAIContentAware: boolean,
  glossaryEnabled: boolean,
  videoContext: SubtitlesVideoContext,
): Promise<string> {
  const subtitlePromptContext = normalizeSubtitlePromptContext(videoContext)
  // Resolved once on the page, where the URL says which glossaries apply, and
  // then carried by the request — the background serves every tab at once.
  const { terms: glossaryTerms, revision: glossaryRevision } = await resolveGlossaryTerms(
    prepareTranslationText(text),
    glossaryEnabled,
    langConfig.targetCode,
  )
  trackGlossaryUsed(
    "videoSubtitles",
    glossaryTerms,
    langConfig.targetCode,
    classifySerializedProvider(providerRef),
  )
  const hashComponents = await buildSubtitleHashComponents(
    text,
    providerRef,
    { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode },
    enableAIContentAware,
    videoContext.subtitlesTextContent,
    glossaryTerms,
  )

  return await sendMessage("enqueueSubtitlesTranslateRequest", {
    text,
    langConfig,
    providerRef,
    scheduleAt: Date.now(),
    hash: Sha256Hex(...hashComponents),
    webTitle: subtitlePromptContext.webTitle,
    webDescription: subtitlePromptContext.webDescription,
    summary: enableAIContentAware ? subtitlePromptContext.videoSummary : undefined,
    glossaryTerms,
    glossaryRevision,
  })
}

export type SubtitlesProviderResolution<
  Ref extends SerializableProviderRef = SerializableProviderRef,
> =
  | { status: "ok"; ref: Ref }
  | { status: "hostedUnavailable"; message: string }
  | { status: "notPromptable" }
  | { status: "none" }

/** Reports without announcing, so callers can tell a plan/quota refusal from "nothing selected". */
export async function resolveSubtitlesProvider(
  config: Config,
  task: "lineTranslation",
): Promise<SubtitlesProviderResolution>
export async function resolveSubtitlesProvider(
  config: Config,
  task: "summary" | "segmentation",
): Promise<SubtitlesProviderResolution<PromptableProviderRef>>
export async function resolveSubtitlesProvider(
  config: Config,
  task: SubtitlesTask,
): Promise<SubtitlesProviderResolution>
export async function resolveSubtitlesProvider(
  config: Config,
  task: SubtitlesTask,
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
    if (task !== "lineTranslation") {
      // A summary or a recut is a generation, but the subtitles provider list
      // is gated on the wider translate capability — so the default Microsoft
      // provider resolves here legally and then cannot be prompted. Refuse
      // before serializing: no ref a caller could misuse, and no doomed
      // hostedAi.status fetch for a provider that will never run the task.
      if (!canResolvedProviderRefGenerateText(resolved)) {
        return { status: "notPromptable" }
      }
      return { status: "ok", ref: await serializeProviderRef(resolved, SUBTITLES_TASK_ROUTE[task]) }
    }
    return { status: "ok", ref: await serializeProviderRef(resolved, SUBTITLES_TASK_ROUTE[task]) }
  } catch (error) {
    if (error instanceof HostedAiProviderUnavailableError) {
      return { status: "hostedUnavailable", message: error.message }
    }
    // Nothing else is expected to throw here (serializeProviderRef already
    // fails open on an unreachable status endpoint). Keep degrading rather
    // than introducing a new throw into the render path, but leave a trace.
    log.warn("Provider ref resolution failed", { error })
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
  task: "lineTranslation",
): Promise<SerializableProviderRef | null>
export async function resolveSubtitlesProviderRef(
  config: Config,
  task: "summary" | "segmentation",
): Promise<PromptableProviderRef | null>
export async function resolveSubtitlesProviderRef(
  config: Config,
  task: SubtitlesTask,
): Promise<SerializableProviderRef | null> {
  const resolution = await resolveSubtitlesProvider(config, task)
  if (resolution.status === "hostedUnavailable") {
    // Silence here is indistinguishable from "these lines have no translation".
    toastManager.add({
      type: "error",
      title: resolution.message,
      id: SUBTITLES_HOSTED_UNAVAILABLE_TOAST_ID,
    })
    return null
  }
  // notPromptable degrades silently: unlike a hosted denial (something the
  // user was refused), it is a configuration state the pre-flight UI explains.
  return resolution.status === "ok" ? resolution.ref : null
}

export async function fetchSubtitlesSummary(
  videoContext: SubtitlesVideoContext,
  configOverride?: Config,
  providerRef?: PromptableProviderRef | null,
): Promise<string | null> {
  // Tri-state ref: a session that already resolved and narrowed its ref passes
  // it through — re-resolving could mint a different cache identity mid-session
  // and costs a second hostedAi.status round trip. `null` means the session
  // narrowed to "no promptable provider": skip outright, no message. Omitted
  // means "resolve here" (standalone callers).
  if (providerRef === null) {
    return null
  }

  const config = configOverride ?? (await getLocalConfig())
  if (!config?.pageTranslation.enableAIContentAware) {
    return null
  }

  const ref = providerRef ?? (await resolveSubtitlesProviderRef(config, "summary"))
  if (!ref) {
    return null
  }

  if (!videoContext.videoTitle || !videoContext.subtitlesTextContent) {
    return null
  }

  return await sendMessage("getSubtitlesSummary", {
    videoTitle: videoContext.videoTitle,
    subtitlesContext: videoContext.subtitlesTextContent,
    providerRef: ref,
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

  const providerRef = await resolveSubtitlesProviderRef(config, "lineTranslation")
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
      config.glossary.enabled,
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
