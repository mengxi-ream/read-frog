import type { PromptExperimentVariant, TranslationActionContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import type { LLMProviderConfig, ProviderConfig } from "@/types/config/provider"
import type { BatchQueueConfig, RequestQueueConfig } from "@/types/config/translate"
import type { SubtitlePromptContext, WebPagePromptContext } from "@/types/content"
import type { PromptResolver } from "@/utils/host/translate/api/ai"
import { browser } from "#imports"
import { isLLMProviderConfig } from "@/types/config/provider"
import { putBatchRequestRecord } from "@/utils/batch-request-record"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BATCH_SEPARATOR, BATCH_SEPARATOR_LINE_PATTERN } from "@/utils/constants/prompt"
import { generateArticleSummary } from "@/utils/content/summary"
import { cleanText } from "@/utils/content/utils"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { microsoftTranslate } from "@/utils/host/translate/api/microsoft"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import {
  assertHtmlAttributeMarkerIntegrity,
  hasHtmlAttributeMarkerProtocol,
  isHtmlAttributeMarkerIntegrityError,
} from "@/utils/host/translate/html-attribute-markers"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { BatchQueue } from "@/utils/request/batch-queue"
import { CancelledScopeRegistry, TranslationCancelledError } from "@/utils/request/cancellation"
import { RequestQueue } from "@/utils/request/request-queue"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"
import {
  clearPromptExperimentAction,
  clearPromptExperimentActionsByPrefix,
  exposePromptExperiment,
  resolvePromptExperimentVariant,
} from "./analytics"
import { ensureInitializedConfig } from "./config"

export function parseBatchResult(result: string): string[] {
  return result
    .trim()
    .split(BATCH_SEPARATOR_LINE_PATTERN)
    .map((t) => t.trim())
}

export function shouldUseBatchQueue(providerConfig: ProviderConfig): boolean {
  return isLLMProviderConfig(providerConfig)
}

class PromptExperimentDispatchChangedError extends Error {
  constructor(readonly latestVariant: PromptExperimentVariant | null) {
    super("Prompt experiment variant changed before dispatch")
    this.name = "PromptExperimentDispatchChangedError"
    attachRequestErrorMeta(this, { isRetryable: false })
  }
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
): Promise<string[]> {
  const { langConfig, providerConfig, context } = dataList[0]
  const texts = dataList.map((d) => d.text)

  const batchText = texts.join(`\n\n${BATCH_SEPARATOR}\n\n`)
  const result = await executeTranslate(batchText, langConfig, providerConfig, promptResolver, {
    isBatch: true,
    context,
    signal,
  })
  return parseBatchResult(result)
}

async function getOrGenerateWebPageSummary(
  webTitle: string,
  webContent: string,
  providerConfig: LLMProviderConfig,
  requestQueue: RequestQueue,
): Promise<string | null> {
  const preparedText = cleanText(webContent)
  if (!preparedText) {
    return null
  }

  const textHash = Sha256Hex(preparedText)
  const cacheKey = Sha256Hex(webTitle, textHash, JSON.stringify(providerConfig))

  const cached = await db.articleSummaryCache.get(cacheKey)
  if (cached) {
    logger.info("Using cached summary")
    return cached.summary
  }

  const thunk = async () => {
    const cachedAgain = await db.articleSummaryCache.get(cacheKey)
    if (cachedAgain) {
      return cachedAgain.summary
    }

    const summary = await generateArticleSummary(webTitle, webContent, providerConfig)
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

async function getOrGenerateSubtitleSummary(
  videoTitle: string,
  subtitlesContext: string,
  providerConfig: LLMProviderConfig,
  requestQueue: RequestQueue,
): Promise<string | null> {
  const preparedText = cleanText(subtitlesContext)
  if (!preparedText) {
    return null
  }

  const textHash = Sha256Hex(preparedText)
  const cacheKey = Sha256Hex(textHash, JSON.stringify(providerConfig))

  const cached = await db.articleSummaryCache.get(cacheKey)
  if (cached) {
    logger.info("Using cached summary")
    return cached.summary
  }

  const thunk = async () => {
    const cachedAgain = await db.articleSummaryCache.get(cacheKey)
    if (cachedAgain) {
      return cachedAgain.summary
    }

    const summary = await generateArticleSummary(videoTitle, subtitlesContext, providerConfig)
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

export interface TranslateBatchData<TContext = unknown> {
  text: string
  langConfig: Config["language"]
  providerConfig: ProviderConfig
  hash: string
  scheduleAt: number
  context?: TContext
  // Cancellation scope (`${tabId}:${sessionId}`); absent = uncancellable.
  scope?: string
  promptExperimentVariant?: PromptExperimentVariant
  translationActionContext?: TranslationActionContext
  actionDedupeKey?: string
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
  beforeDispatch?: (dataList: TranslateBatchData<TContext>[]) => Promise<void>
}

async function createTranslationQueues<TContext>(config: TranslationQueueSetupConfig<TContext>) {
  const { rate, capacity } = config.requestQueueConfig
  const { maxCharactersPerBatch, maxItemsPerBatch } = config.batchQueueConfig
  const { promptResolver, isScopeCancelled, beforeDispatch } = config

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
    getBatchKey: (data) => {
      return Sha256Hex(
        `${data.langConfig.sourceCode}-${data.langConfig.targetCode}-${data.providerConfig.id}`,
        data.context ? JSON.stringify(data.context) : "",
      )
    },
    getCharacters: (data) => data.text.length,
    getDedupKey: (data) => data.hash,
    getScope: (data) => data.scope,
    isScopeCancelled,
    executeBatch: async (dataList, meta) => {
      const { providerConfig } = dataList[0]
      const hash = Sha256Hex(...dataList.map((d) => d.hash))
      const earliestScheduleAt = Math.min(...dataList.map((d) => d.scheduleAt))

      const batchThunk = async (signal?: AbortSignal): Promise<string[]> => {
        await putBatchRequestRecord({ originalRequestCount: dataList.length, providerConfig })
        await beforeDispatch?.(dataList)
        return await executeBatchTranslation(dataList, promptResolver, signal)
      }

      return requestQueue.enqueue(batchThunk, earliestScheduleAt, hash, meta.scopes)
    },
    executeIndividual: async (data) => {
      const { text, langConfig, providerConfig, hash, scheduleAt, context, scope } = data
      const thunk = async (signal?: AbortSignal) => {
        await putBatchRequestRecord({ originalRequestCount: 1, providerConfig })
        await beforeDispatch?.([data])
        return executeTranslate(text, langConfig, providerConfig, promptResolver, {
          context,
          signal,
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

export async function setUpWebPageTranslationQueue() {
  const config = await ensureInitializedConfig()

  const {
    translate: { requestQueueConfig, batchQueueConfig },
  } = config ?? DEFAULT_CONFIG

  // Scopes whose cancel already drained the queues. Consulted by (a) the
  // enqueue handler after its cache-lookup await and (b) the batch queue's
  // retry/fallback path after its backoff sleep — both are windows where a
  // request lives in NO cancellable structure, so a cancel arriving there
  // would otherwise be lost (#1881).
  const cancelledScopes = new CancelledScopeRegistry()

  type WebTranslationPromptContext = WebPagePromptContext & {
    promptExperimentVariant?: PromptExperimentVariant
  }

  const webPromptResolver: PromptResolver<WebTranslationPromptContext> = (
    targetLang,
    input,
    options,
  ) =>
    getTranslatePrompt(targetLang, input, {
      ...options,
      promptExperimentVariant: options?.context?.promptExperimentVariant,
    })

  const { requestQueue, batchQueue } = await createTranslationQueues<WebTranslationPromptContext>({
    requestQueueConfig,
    batchQueueConfig,
    promptResolver: webPromptResolver,
    isScopeCancelled: (scopeKey) => cancelledScopes.has(scopeKey),
    beforeDispatch: async (dataList) => {
      const uniqueActions = new Map<
        string,
        { actionContext: TranslationActionContext; variant: PromptExperimentVariant }
      >()
      for (const data of dataList) {
        if (!data.promptExperimentVariant || !data.translationActionContext) continue
        const dedupeKey = data.actionDedupeKey ?? data.translationActionContext.actionId
        uniqueActions.set(dedupeKey, {
          actionContext: data.translationActionContext,
          variant: data.promptExperimentVariant,
        })
      }

      for (const [dedupeKey, { actionContext, variant }] of uniqueActions) {
        const exposed = await exposePromptExperiment(actionContext, variant, dedupeKey)
        if (!exposed) {
          const latestVariant = await resolvePromptExperimentVariant("default")
          throw new PromptExperimentDispatchChangedError(latestVariant)
        }
      }
    },
  })

  onMessage("enqueueTranslateRequest", async (message) => {
    const {
      data: {
        text,
        langConfig,
        providerConfig,
        scheduleAt,
        hash,
        textFormat,
        webTitle,
        webDescription,
        webContent,
        webSummary,
        sessionId,
        promptExperimentVariant,
        translationActionContext,
      },
    } = message
    const scope = buildTranslationScopeKey(message.sender, sessionId)

    const validateHtmlAttributeMarkers =
      textFormat === "html" && hasHtmlAttributeMarkerProtocol(text)
    if (validateHtmlAttributeMarkers) {
      assertHtmlAttributeMarkerIntegrity(text, text)
    }

    // Check cache first
    if (hash) {
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

    let effectivePromptExperimentVariant = promptExperimentVariant
    let cacheUnderRequestedHash = true
    if (promptExperimentVariant) {
      const latestVariant = await resolvePromptExperimentVariant("default")
      if (latestVariant && latestVariant !== promptExperimentVariant) {
        return { retryWithPromptExperimentVariant: latestVariant }
      }
      if (!latestVariant) {
        effectivePromptExperimentVariant = undefined
        cacheUnderRequestedHash = false
      }
    }

    let result: string
    const context: WebTranslationPromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      webContent: normalizePromptContextValue(webContent),
      webSummary: normalizePromptContextValue(webSummary),
      promptExperimentVariant: effectivePromptExperimentVariant,
    }

    if (shouldUseBatchQueue(providerConfig)) {
      const data = {
        text,
        langConfig,
        providerConfig,
        hash,
        scheduleAt,
        context,
        scope,
        promptExperimentVariant: effectivePromptExperimentVariant,
        translationActionContext,
        actionDedupeKey:
          translationActionContext?.feature === "page_translation"
            ? (scope ?? translationActionContext.actionId)
            : translationActionContext?.actionId,
      }
      try {
        result = await batchQueue.enqueue(data)
      } catch (error) {
        if (error instanceof PromptExperimentDispatchChangedError) {
          if (error.latestVariant) {
            return { retryWithPromptExperimentVariant: error.latestVariant }
          }
          const retryResponse: { retryWithoutPromptExperiment: true } = {
            retryWithoutPromptExperiment: true,
          }
          return retryResponse
        }
        throw error
      }
    } else {
      // Create thunk based on type and params
      const thunk = (signal?: AbortSignal) =>
        executeTranslate(text, langConfig, providerConfig, getTranslatePrompt, {
          textFormat,
          signal,
        })
      result = await requestQueue.enqueue(thunk, scheduleAt, hash, scope ? [scope] : undefined)
    }

    if (validateHtmlAttributeMarkers) {
      assertHtmlAttributeMarkerIntegrity(text, result)
    }

    // Cache the translation result if successful
    if (result && hash && cacheUnderRequestedHash) {
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("getOrGenerateWebPageSummary", async (message) => {
    const { webTitle, webContent, providerConfig } = message.data

    if (!isLLMProviderConfig(providerConfig) || !webTitle || !webContent) {
      return null
    }

    return await getOrGenerateWebPageSummary(webTitle, webContent, providerConfig, requestQueue)
  })

  onMessage("setTranslateRequestQueueConfig", (message) => {
    const { data } = message
    requestQueue.setQueueOptions(data)
  })

  onMessage("setTranslateBatchQueueConfig", (message) => {
    const { data } = message
    batchQueue.setBatchConfig(data)
  })

  onMessage("cancelPageTranslationRequests", (message) => {
    const scope = buildTranslationScopeKey(message.sender, message.data.sessionId)
    if (!scope) return
    // Remember the scope so enqueue handlers suspended on the cache lookup
    // refuse to enqueue after this drain.
    cancelledScopes.markScope(scope)
    clearPromptExperimentAction(scope)
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
    clearPromptExperimentActionsByPrefix(prefix)
    batchQueue.cancelWhere((scope) => scope.startsWith(prefix))
    requestQueue.cancelWhere((scope) => scope.startsWith(prefix))
  })
}

/**
 * Set up subtitles translation queue and message handlers
 */
export async function setUpSubtitlesTranslationQueue() {
  const config = await ensureInitializedConfig()
  const {
    videoSubtitles: { requestQueueConfig, batchQueueConfig },
  } = config ?? DEFAULT_CONFIG

  const { requestQueue, batchQueue } = await createTranslationQueues({
    requestQueueConfig,
    batchQueueConfig,
    promptResolver: getSubtitlesTranslatePrompt,
  })

  onMessage("enqueueSubtitlesTranslateRequest", async (message) => {
    const {
      data: {
        text,
        langConfig,
        providerConfig,
        scheduleAt,
        hash,
        webTitle,
        webDescription,
        summary,
      },
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

    if (shouldUseBatchQueue(providerConfig)) {
      const data = { text, langConfig, providerConfig, hash, scheduleAt, context }
      result = await batchQueue.enqueue(data)
    } else {
      const thunk = (signal?: AbortSignal) =>
        executeTranslate(text, langConfig, providerConfig, getSubtitlesTranslatePrompt, { signal })
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
    const { videoTitle, subtitlesContext, providerConfig } = message.data

    if (!isLLMProviderConfig(providerConfig) || !videoTitle || !subtitlesContext) {
      return null
    }

    return await getOrGenerateSubtitleSummary(
      videoTitle,
      subtitlesContext,
      providerConfig,
      requestQueue,
    )
  })

  onMessage("microsoftBatchTranslate", async (message) => {
    const { texts, fromLang, toLang } = message.data
    const hash = Sha256Hex("ms-batch", fromLang, toLang, ...texts)
    const thunk = (signal?: AbortSignal) => microsoftTranslate(texts, fromLang, toLang, { signal })
    return requestQueue.enqueue(thunk, Date.now(), hash)
  })

  onMessage("setSubtitlesRequestQueueConfig", (message) => {
    const { data } = message
    requestQueue.setQueueOptions(data)
  })

  onMessage("setSubtitlesBatchQueueConfig", (message) => {
    const { data } = message
    batchQueue.setBatchConfig(data)
  })
}
