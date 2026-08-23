import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { BatchQueueConfig, RequestQueueConfig } from "@/types/config/translate"
import type { SubtitlePromptContext, WebPagePromptContext } from "@/types/content"
import type { PromptResolver } from "@/utils/host/translate/api/ai"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { browser, storage } from "#imports"
import { isLLMProviderConfig } from "@/types/config/provider"
import { putBatchRequestRecord } from "@/utils/batch-request-record"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BATCH_SEPARATOR,
  BATCH_SEPARATOR_LINE_PATTERN,
  isNoTranslationSentinel,
} from "@/utils/constants/prompt"
import {
  BATCH_TIMEOUT_BASE_MS,
  BATCH_TIMEOUT_PER_CHAR_MS,
  MAX_BATCH_TIMEOUT_MS,
} from "@/utils/constants/translate"
import { generateArticleSummary } from "@/utils/content/summary"
import { cleanText } from "@/utils/content/utils"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import {
  assertHtmlAttributeMarkerIntegrity,
  hasHtmlAttributeMarkerProtocol,
  isHtmlAttributeMarkerIntegrityError,
} from "@/utils/host/translate/html-attribute-markers"
import {
  auditInlineAtomTokens,
  hasInlineAtomTokens,
} from "@/utils/host/translate/inline-atom-tokens"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import { getVideoSummaryPrompt } from "@/utils/prompts/summary"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import {
  canProviderRefGenerateText,
  getProviderCacheIdentity,
} from "@/utils/providers/provider-ref"
import { BatchQueue } from "@/utils/request/batch-queue"
import { CancelledScopeRegistry, TranslationCancelledError } from "@/utils/request/cancellation"
import { RequestQueue } from "@/utils/request/request-queue"
import { generateTextForProviderRef } from "./background-stream"
import { runStreamTextInBackground } from "./background-stream"
import { ensureInitializedConfig } from "./config"

type QueuedTranslationProvider = ProviderConfig | SerializableProviderRef

function isSerializedPageProvider(
  provider: QueuedTranslationProvider,
): provider is SerializableProviderRef {
  return "kind" in provider && (provider.kind === "local" || provider.kind === "system")
}

function getLocalProviderConfig(provider: QueuedTranslationProvider): ProviderConfig | null {
  if (!isSerializedPageProvider(provider)) return provider
  return provider.kind === "local" ? provider.config : null
}

function getQueuedProviderId(provider: QueuedTranslationProvider): string {
  const local = getLocalProviderConfig(provider)
  return local?.id ?? (provider as Extract<SerializableProviderRef, { kind: "system" }>).providerId
}

async function executeQueuedTranslation<TContext>(
  text: string,
  langConfig: Config["language"],
  provider: QueuedTranslationProvider,
  promptResolver: PromptResolver<TContext>,
  options: {
    isBatch?: boolean
    context?: TContext
    textFormat?: import("@/types/config/translate").TranslationTextFormat
    preserveLineBreaks?: boolean
    signal?: AbortSignal
    hostedRequestId?: string
    /** Which hosted route a system provider bills against. */
    hostedFeature?: HostedAiTextStreamRoute
  } = {},
): Promise<string> {
  const local = getLocalProviderConfig(provider)
  if (local) {
    return executeTranslate(text, langConfig, local, promptResolver, options)
  }

  const system = provider as Extract<SerializableProviderRef, { kind: "system" }>
  if (!options.hostedRequestId) {
    throw new Error("Hosted page translation requires a stable requestId")
  }
  const targetLangName = LANG_CODE_TO_EN_NAME[langConfig.targetCode]
  const { systemPrompt, prompt } = await promptResolver(targetLangName, text, {
    isBatch: options.isBatch,
    context: options.context,
  })
  const result = await runStreamTextInBackground(
    {
      providerId: system.providerId,
      modelTier: system.modelTier,
      requestId: options.hostedRequestId,
      hostedFeature: options.hostedFeature ?? "pageTranslation",
      instructions: systemPrompt,
      prompt,
    },
    { signal: options.signal },
  )
  return result.output.trim()
}

export function parseBatchResult(result: string): string[] {
  return result
    .trim()
    .split(BATCH_SEPARATOR_LINE_PATTERN)
    .map((t) => t.trim())
}

export function shouldUseBatchQueue(provider: QueuedTranslationProvider): boolean {
  const local = getLocalProviderConfig(provider)
  return local ? isLLMProviderConfig(local) : true
}

async function getValidatedCachedTranslation(
  hash: string,
  sourceText: string,
  validateHtmlAttributeMarkers: boolean,
): Promise<string | undefined> {
  const cached = await db.translationCache.get(hash)
  if (!cached) return undefined
  if (!validateHtmlAttributeMarkers) return cached.translation

  try {
    assertHtmlAttributeMarkerIntegrity(sourceText, cached.translation)
    return cached.translation
  } catch (error) {
    if (!isHtmlAttributeMarkerIntegrityError(error)) throw error

    await db.translationCache.delete(hash)
    logger.warn("Deleted cached translation with invalid HTML attribute markers", error)
    return undefined
  }
}

export async function executeBatchTranslation<TContext>(
  dataList: TranslateBatchData<TContext>[],
  promptResolver: PromptResolver<TContext>,
  signal?: AbortSignal,
  hostedRequestId?: string,
  hostedFeature?: HostedAiTextStreamRoute,
): Promise<string[]> {
  const { langConfig, provider, context } = dataList[0]!
  const texts = dataList.map((d) => d.text)

  const batchText = texts.join(`\n\n${BATCH_SEPARATOR}\n\n`)
  const result = await executeQueuedTranslation(batchText, langConfig, provider, promptResolver, {
    isBatch: true,
    context,
    signal,
    hostedRequestId,
    hostedFeature,
  })
  return parseBatchResult(result)
}

/**
 * One cached, queued summary generation for both the page summary and the
 * video summary. The two were byte-for-byte identical apart from which parts
 * went into the cache key, so the key parts are the parameter and everything
 * else — the double-check inside the thunk, the empty-string sentinel that
 * keeps a failed generation from being cached as a hit, the queue admission —
 * is shared.
 */
async function getOrGenerateSummary(args: {
  title: string
  textContent: string
  providerRef: SerializableProviderRef
  hostedFeature: HostedAiTextStreamRoute
  cacheKeyParts: string[]
  requestQueue: RequestQueue
}): Promise<string | null> {
  const { title, textContent, providerRef, hostedFeature, cacheKeyParts, requestQueue } = args
  const preparedText = cleanText(textContent)
  if (!preparedText) {
    return null
  }

  const cacheKey = Sha256Hex(...cacheKeyParts, getProviderCacheIdentity(providerRef))

  const cached = await db.articleSummaryCache.get(cacheKey)
  if (cached) {
    logger.info("Using cached summary")
    return cached.summary
  }

  // Stable for this queue task, mirroring the translation batches: automatic
  // RequestQueue retries must reuse the idempotency key because the first
  // hosted response may have been lost after billing.
  const hostedRequestId = providerRef.kind === "system" ? getRandomUUID() : undefined

  const thunk = async (signal?: AbortSignal) => {
    const cachedAgain = await db.articleSummaryCache.get(cacheKey)
    if (cachedAgain) {
      return cachedAgain.summary
    }

    const summary = await generateArticleSummary(title, textContent, providerRef, {
      hostedFeature,
      signal,
      generate: (payload, runOptions) =>
        generateTextForProviderRef({ ...payload, requestId: hostedRequestId }, runOptions),
    })
    if (!summary) {
      return ""
    }

    await db.articleSummaryCache.put({
      key: cacheKey,
      summary,
      createdAt: new Date(),
    })

    logger.info("Generated and cached new summary")
    return summary
  }

  try {
    const summary = await requestQueue.enqueue(thunk, Date.now(), cacheKey)
    return summary || null
  } catch (error) {
    logger.warn("Failed to get/generate summary:", error)
    return null
  }
}

/**
 * Bumped whenever the summary prompt changes: the cache key has to move with
 * it or every user keeps being served answers from the old wording.
 */
const VIDEO_SUMMARY_PROMPT_VERSION = "1"

async function getOrGenerateVideoSummary(args: {
  transcript: string
  targetLanguage: string
  providerRef: SerializableProviderRef
  requestQueue: RequestQueue
}): Promise<string | null> {
  const { transcript, targetLanguage, providerRef, requestQueue } = args

  const cacheKey = Sha256Hex(
    Sha256Hex(transcript),
    targetLanguage,
    VIDEO_SUMMARY_PROMPT_VERSION,
    getProviderCacheIdentity(providerRef),
  )

  const cached = await db.articleSummaryCache.get(cacheKey)
  if (cached) {
    return cached.summary
  }

  const hostedRequestId = providerRef.kind === "system" ? getRandomUUID() : undefined

  const thunk = async (signal?: AbortSignal) => {
    const cachedAgain = await db.articleSummaryCache.get(cacheKey)
    if (cachedAgain) {
      return cachedAgain.summary
    }

    const { systemPrompt, prompt } = getVideoSummaryPrompt(targetLanguage, transcript)
    const summary = await generateTextForProviderRef(
      {
        providerRef,
        hostedFeature: "videoSubtitles",
        instructions: systemPrompt,
        prompt,
        requestId: hostedRequestId,
      },
      { signal },
    )

    const trimmed = summary.trim()
    if (!trimmed) {
      return ""
    }

    await db.articleSummaryCache.put({ key: cacheKey, summary: trimmed, createdAt: new Date() })
    return trimmed
  }

  try {
    const summary = await requestQueue.enqueue(thunk, Date.now(), cacheKey)
    return summary || null
  } catch (error) {
    logger.warn("Failed to get/generate video summary:", error)
    return null
  }
}

export interface TranslateBatchData<TContext = unknown> {
  text: string
  langConfig: Config["language"]
  provider: QueuedTranslationProvider
  hash: string
  scheduleAt: number
  context?: TContext
  // Cancellation scope (`${tabId}:${sessionId}`); absent = uncancellable.
  scope?: string
  // Which hosted route a system provider bills against. Part of the batch key,
  // so requests for different routes never share a batch (a batch bills as one
  // unit). Absent for pre-update senders — the queue's default route applies.
  hostedFeature?: HostedAiTextStreamRoute
}

/**
 * Compose the cancellation scope from the message sender and the content
 * script's session id. Building it background-side from `sender.tab.id` makes
 * cross-tab cancellation impossible by construction.
 */
export function buildTranslationScopeKey(
  sender: { tab?: { id?: number } } | undefined,
  sessionId: string | undefined,
): string | undefined {
  const tabId = sender?.tab?.id
  return typeof tabId === "number" && sessionId ? `${tabId}:${sessionId}` : undefined
}

interface TranslationQueueSetupConfig<TContext = unknown> {
  requestQueueConfig: RequestQueueConfig
  batchQueueConfig: BatchQueueConfig
  promptResolver: PromptResolver<TContext>
  // Present only for queues whose requests carry cancellation scopes.
  isScopeCancelled?: (scopeKey: string) => boolean
  queueName: "webpage" | "subtitles"
  /**
   * Fallback hosted route for requests that carry none (pre-update content
   * scripts). Current senders name their own route on the request — input
   * translation shares the webpage queue but bills separately.
   */
  hostedFeature: HostedAiTextStreamRoute
  // "default" means the user's stored config could not be loaded — the queue
  // is running on DEFAULT_CONFIG values (rate 8 / capacity 20), NOT what the
  // options page shows. Logged loudly so support reports are diagnosable.
  configSource: "user" | "default"
}

async function createTranslationQueues<TContext>(config: TranslationQueueSetupConfig<TContext>) {
  const { rate, capacity } = config.requestQueueConfig
  const { maxCharactersPerBatch, maxItemsPerBatch } = config.batchQueueConfig
  const { promptResolver, isScopeCancelled, queueName, configSource } = config
  const queueHostedFeature = config.hostedFeature

  logger.info(`[translation-queues] ${queueName} queue init`, {
    rate,
    capacity,
    maxCharactersPerBatch,
    maxItemsPerBatch,
    configSource,
  })
  if (configSource === "default") {
    logger.error(
      `[translation-queues] ${queueName} queue running on DEFAULT config (rate ${rate}, capacity ${capacity}) — user config unavailable at init`,
    )
  }

  const requestQueue = new RequestQueue({
    rate,
    capacity,
    timeoutMs: 20_000,
    maxRetries: 2,
    baseRetryDelayMs: 1_000,
  })
  const batchQueue = new BatchQueue<TranslateBatchData<TContext>, string>({
    maxCharactersPerBatch,
    maxItemsPerBatch,
    batchDelay: 100,
    maxRetries: 3,
    enableFallbackToIndividual: true,
    // Narrow port, not the whole queue: while the rate limiter has no free
    // slot, pending batches keep filling to maxItems/maxChars instead of
    // flushing tiny every batchDelay (they'd only freeze in the queue).
    dispatchGate: { nextDispatchEtaMs: () => requestQueue.nextDispatchEtaMs() },
    getBatchKey: (data) => {
      return Sha256Hex(
        `${data.langConfig.sourceCode}-${data.langConfig.targetCode}-${getQueuedProviderId(data.provider)}`,
        data.context ? JSON.stringify(data.context) : "",
        data.hostedFeature ?? queueHostedFeature,
      )
    },
    getCharacters: (data) => data.text.length,
    getDedupKey: (data) => data.hash,
    getScope: (data) => data.scope,
    isScopeCancelled,
    executeBatch: async (dataList, meta) => {
      const { provider } = dataList[0]!
      // Stable for this RequestQueue task: automatic retries must reuse the
      // idempotency key because the first hosted response may have been lost.
      // A BatchQueue retry/fallback invokes this adapter again and gets a new
      // key for that new real model call.
      const hostedRequestId = getLocalProviderConfig(provider) ? undefined : getRandomUUID()
      const hash = Sha256Hex(...dataList.map((d) => d.hash))
      const earliestScheduleAt = Math.min(...dataList.map((d) => d.scheduleAt))
      const totalCharacters = dataList.reduce((sum, d) => sum + d.text.length, 0)
      const timeoutMs = Math.min(
        BATCH_TIMEOUT_BASE_MS + totalCharacters * BATCH_TIMEOUT_PER_CHAR_MS,
        MAX_BATCH_TIMEOUT_MS,
      )

      const batchThunk = async (signal?: AbortSignal): Promise<string[]> => {
        const localProvider = getLocalProviderConfig(provider)
        if (localProvider) {
          await putBatchRequestRecord({
            originalRequestCount: dataList.length,
            providerConfig: localProvider,
          })
        }
        // Homogeneous per batch: hostedFeature is part of the batch key.
        return await executeBatchTranslation(
          dataList,
          promptResolver,
          signal,
          hostedRequestId,
          dataList[0]!.hostedFeature ?? queueHostedFeature,
        )
      }

      return requestQueue.enqueue(batchThunk, earliestScheduleAt, hash, meta.scopes, { timeoutMs })
    },
    executeIndividual: async (data) => {
      const { text, langConfig, provider, hash, scheduleAt, context, scope } = data
      // This individual fallback is its own model call, but any automatic
      // retries of its RequestQueue thunk reuse the same idempotency key.
      const hostedRequestId = getLocalProviderConfig(provider) ? undefined : getRandomUUID()
      const thunk = async (signal?: AbortSignal) => {
        const localProvider = getLocalProviderConfig(provider)
        if (localProvider) {
          await putBatchRequestRecord({ originalRequestCount: 1, providerConfig: localProvider })
        }
        return executeQueuedTranslation(text, langConfig, provider, promptResolver, {
          context,
          signal,
          hostedRequestId,
          hostedFeature: data.hostedFeature ?? queueHostedFeature,
        })
      }
      return requestQueue.enqueue(thunk, scheduleAt, hash, scope ? [scope] : undefined)
    },
    onError: (error, context) => {
      const errorType = context.isFallback ? "Individual request" : "Batch request"
      logger.error(
        `${errorType} failed (batchKey: ${context.batchKey}, retry: ${context.retryCount}):`,
        error.message,
      )
    },
  })

  return { requestQueue, batchQueue }
}

/**
 * Load the persisted config and build the queues. Never rejects: a broken
 * storage layer degrades to DEFAULT_CONFIG (loudly logged) instead of leaving
 * every translation message rejected.
 */
async function loadQueueSetupConfig(
  queueName: "webpage" | "subtitles",
  selectConfig: (config: Config) => {
    requestQueueConfig: RequestQueueConfig
    batchQueueConfig: BatchQueueConfig
  },
): Promise<{
  requestQueueConfig: RequestQueueConfig
  batchQueueConfig: BatchQueueConfig
  configSource: "user" | "default"
}> {
  let config: Config | null = null
  try {
    config = await ensureInitializedConfig()
  } catch (error) {
    logger.error(`[translation-queues] failed to load config for ${queueName} queue`, error)
  }
  return {
    ...selectConfig(config ?? DEFAULT_CONFIG),
    configSource: config ? "user" : "default",
  }
}

/**
 * Re-apply queue config from storage on every persisted change. This replaces
 * the per-field set*QueueConfig messages: those could be dropped while the SW
 * was cold-starting (handlers used to register only after awaits), silently
 * leaving the live queue on stale values.
 */
function watchQueueConfig(
  queueName: "webpage" | "subtitles",
  queuesPromise: Promise<{
    requestQueue: RequestQueue
    batchQueue: { setBatchConfig: (config: Partial<BatchQueueConfig>) => void }
  }>,
  selectConfig: (config: Config) => {
    requestQueueConfig: RequestQueueConfig
    batchQueueConfig: BatchQueueConfig
  },
) {
  let lastAppliedJson: string | null = null
  storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (newConfig) => {
    if (!newConfig) return
    void queuesPromise.then(({ requestQueue, batchQueue }) => {
      try {
        const selected = selectConfig(newConfig)
        const json = JSON.stringify(selected)
        if (json === lastAppliedJson) return
        requestQueue.setQueueOptions(selected.requestQueueConfig)
        batchQueue.setBatchConfig(selected.batchQueueConfig)
        lastAppliedJson = json
        logger.info(`[translation-queues] ${queueName} queue config updated`, selected)
      } catch (error) {
        logger.error(`[translation-queues] failed to apply ${queueName} queue config change`, error)
      }
    })
  })
}

const selectWebPageQueueConfig = (config: Config) => ({
  requestQueueConfig: config.pageTranslation.requestQueueConfig,
  batchQueueConfig: config.pageTranslation.batchQueueConfig,
})

export function setUpWebPageTranslationQueue(): void {
  // Scopes whose cancel already drained the queues. Consulted by (a) the
  // enqueue handler after its cache-lookup await and (b) the batch queue's
  // retry/fallback path after its backoff sleep — both are windows where a
  // request lives in NO cancellable structure, so a cancel arriving there
  // would otherwise be lost (#1881).
  const cancelledScopes = new CancelledScopeRegistry()

  type WebTranslationPromptContext = WebPagePromptContext

  const webPromptResolver: PromptResolver<WebTranslationPromptContext> = getTranslatePrompt

  const queuesPromise = loadQueueSetupConfig("webpage", selectWebPageQueueConfig).then(
    ({ requestQueueConfig, batchQueueConfig, configSource }) =>
      createTranslationQueues<WebTranslationPromptContext>({
        requestQueueConfig,
        batchQueueConfig,
        promptResolver: webPromptResolver,
        isScopeCancelled: (scopeKey) => cancelledScopes.has(scopeKey),
        queueName: "webpage",
        hostedFeature: "pageTranslation",
        configSource,
      }),
  )

  // Everything below registers in the FIRST synchronous turn of the SW: an
  // MV3 wake-triggering message can no longer be dropped while init awaits.
  watchQueueConfig("webpage", queuesPromise, selectWebPageQueueConfig)

  onMessage("enqueueTranslateRequest", async (message) => {
    const { requestQueue, batchQueue } = await queuesPromise
    const {
      data: {
        text,
        langConfig,
        providerRef,
        scheduleAt,
        hash,
        textFormat,
        preserveLineBreaks,
        webTitle,
        webDescription,
        webContent,
        webSummary,
        sessionId,
        forceRetranslation = false,
        hostedFeature,
      },
    } = message
    const scope = buildTranslationScopeKey(message.sender, sessionId)

    const validateHtmlAttributeMarkers =
      textFormat === "html" && hasHtmlAttributeMarkerProtocol(text)
    if (validateHtmlAttributeMarkers) {
      assertHtmlAttributeMarkerIntegrity(text, text)
    }

    // Check cache first — unless the user asked for a fresh translation. The
    // existing entry is left untouched unless the fresh request succeeds below.
    if (hash && !forceRetranslation) {
      const cachedTranslation = await getValidatedCachedTranslation(
        hash,
        text,
        validateHtmlAttributeMarkers,
      )
      if (cachedTranslation !== undefined) return cachedTranslation
    }

    // The cache lookup above yielded — the session's cancel may have drained
    // the queues while this handler was suspended. Enqueueing now would park
    // an undraininable task on a dead scope, so abort instead (the content
    // side swallows this error).
    if (scope && cancelledScopes.has(scope)) {
      throw new TranslationCancelledError(scope)
    }

    let result: string
    const context: WebTranslationPromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      webContent: normalizePromptContextValue(webContent),
      webSummary: normalizePromptContextValue(webSummary),
    }

    if (shouldUseBatchQueue(providerRef)) {
      const data = {
        text,
        langConfig,
        provider: providerRef,
        hash,
        scheduleAt,
        context,
        scope,
        hostedFeature,
      }
      result = await batchQueue.enqueue(data)
    } else {
      const localProvider = getLocalProviderConfig(providerRef)
      if (!localProvider) {
        throw new Error("Invalid local page translation provider")
      }
      // Create thunk based on type and params
      const thunk = (signal?: AbortSignal) =>
        executeTranslate(text, langConfig, localProvider, getTranslatePrompt, {
          textFormat,
          preserveLineBreaks,
          signal,
        })
      result = await requestQueue.enqueue(thunk, scheduleAt, hash, scope ? [scope] : undefined)
    }

    if (validateHtmlAttributeMarkers) {
      assertHtmlAttributeMarkerIntegrity(text, result)
    }

    // A response that dropped, invented or duplicated an inline-atom
    // placeholder is still rendered by the content script (the formulas are
    // appended) but must not be persisted: the next visit deserves a fresh
    // attempt instead of a permanently degraded paragraph. The sentinel is
    // exempt — "no translation needed" carries no placeholders by definition,
    // and auditing it as a total loss would make every already-in-target-language
    // paragraph containing a formula re-hit the provider on every page load.
    const inlineAtomTokensIntact =
      !hasInlineAtomTokens(text) ||
      isNoTranslationSentinel(result) ||
      auditInlineAtomTokens(text, result).ok
    if (result && !inlineAtomTokensIntact) {
      logger.warn("Inline atom placeholders were not preserved; result not cached")
    }

    // Cache the translation result if successful
    if (result && hash && inlineAtomTokensIntact) {
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("getOrGenerateWebPageSummary", async (message) => {
    const { requestQueue } = await queuesPromise
    const { webTitle, webContent, providerRef } = message.data

    if (!webTitle || !webContent) {
      return null
    }

    return await getOrGenerateSummary({
      title: webTitle,
      textContent: webContent,
      providerRef,
      // The summary bills against the feature that triggered it (it is a
      // sub-call of that feature, not a feature of its own); the sender names
      // that route so the gate it serialized the ref under and the billing here
      // cannot diverge. Absent only from a pre-update content script — page
      // translation is the historical biller.
      hostedFeature: message.data.hostedFeature ?? "pageTranslation",
      cacheKeyParts: [webTitle, Sha256Hex(cleanText(webContent))],
      requestQueue,
    })
  })

  onMessage("cancelPageTranslationRequests", async (message) => {
    const scope = buildTranslationScopeKey(message.sender, message.data.sessionId)
    if (!scope) return
    // Remember the scope BEFORE any await so enqueue handlers suspended on
    // the cache lookup refuse to enqueue after this drain.
    cancelledScopes.markScope(scope)
    const { requestQueue, batchQueue } = await queuesPromise
    // Batch queue first so pending batches cannot flush new request-queue
    // tasks between the two drains.
    const cancelledBatch = batchQueue.cancelByScope(scope)
    const cancelledRequests = requestQueue.cancelByScope(scope)
    if (cancelledBatch + cancelledRequests > 0) {
      logger.info(
        `Cancelled ${cancelledBatch + cancelledRequests} page-translation requests (scope: ${scope})`,
      )
    }
  })

  // A closed tab can never send its cancel message — sweep every scope the
  // tab ever registered (#1881).
  browser.tabs.onRemoved.addListener((tabId) => {
    const prefix = `${tabId}:`
    cancelledScopes.markPrefix(prefix)
    void queuesPromise.then(({ requestQueue, batchQueue }) => {
      batchQueue.cancelWhere((scope) => scope.startsWith(prefix))
      requestQueue.cancelWhere((scope) => scope.startsWith(prefix))
    })
  })
}

const selectSubtitlesQueueConfig = (config: Config) => ({
  requestQueueConfig: config.videoSubtitles.requestQueueConfig,
  batchQueueConfig: config.videoSubtitles.batchQueueConfig,
})

/**
 * Set up subtitles translation queue and message handlers
 */
export function setUpSubtitlesTranslationQueue(): void {
  const queuesPromise = loadQueueSetupConfig("subtitles", selectSubtitlesQueueConfig).then(
    ({ requestQueueConfig, batchQueueConfig, configSource }) =>
      createTranslationQueues({
        requestQueueConfig,
        batchQueueConfig,
        promptResolver: getSubtitlesTranslatePrompt,
        queueName: "subtitles",
        hostedFeature: "videoSubtitles",
        configSource,
      }),
  )

  watchQueueConfig("subtitles", queuesPromise, selectSubtitlesQueueConfig)

  onMessage("enqueueSubtitlesTranslateRequest", async (message) => {
    const { requestQueue, batchQueue } = await queuesPromise
    const {
      data: { text, langConfig, providerRef, scheduleAt, hash, webTitle, webDescription, summary },
    } = message

    if (hash) {
      const cached = await db.translationCache.get(hash)
      if (cached) {
        return cached.translation
      }
    }

    let result: string
    const context: SubtitlePromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      videoSummary: normalizePromptContextValue(summary),
    }

    if (shouldUseBatchQueue(providerRef)) {
      const data = {
        text,
        langConfig,
        provider: providerRef,
        hash,
        scheduleAt,
        context,
      }
      result = await batchQueue.enqueue(data)
    } else {
      // Unreachable for system refs — shouldUseBatchQueue always batches them —
      // but it must fail loudly rather than silently mistranslate if that ever
      // changes, since executeTranslate only understands a local config.
      const localConfig = getLocalProviderConfig(providerRef)
      if (!localConfig) {
        throw new Error("Built-in AI subtitle translation must use the batch queue")
      }
      const thunk = (signal?: AbortSignal) =>
        executeTranslate(text, langConfig, localConfig, getSubtitlesTranslatePrompt, { signal })
      result = await requestQueue.enqueue(thunk, scheduleAt, hash)
    }

    if (result && hash) {
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("getSubtitlesSummary", async (message) => {
    const { requestQueue } = await queuesPromise
    const { videoTitle, subtitlesContext, providerRef } = message.data

    // Guarded on both sides: the content script should not send this for a
    // provider with no model to prompt, and the queue must not admit a task
    // that can only throw if it does.
    if (!videoTitle || !subtitlesContext || !canProviderRefGenerateText(providerRef)) {
      return null
    }

    return await getOrGenerateSummary({
      title: videoTitle,
      textContent: subtitlesContext,
      providerRef,
      hostedFeature: "videoSubtitles",
      // Deliberately without the title, matching the previous key: a video's
      // transcript identifies it, and including a title that players mutate
      // would miss the cache on every re-render.
      cacheKeyParts: [Sha256Hex(cleanText(subtitlesContext))],
      requestQueue,
    })
  })

  onMessage("getVideoSummary", async (message) => {
    const { requestQueue } = await queuesPromise
    const { transcript, targetLanguage, providerRef } = message.data

    if (!transcript || !canProviderRefGenerateText(providerRef)) {
      return null
    }

    return await getOrGenerateVideoSummary({
      transcript,
      targetLanguage,
      providerRef,
      requestQueue,
    })
  })
}
