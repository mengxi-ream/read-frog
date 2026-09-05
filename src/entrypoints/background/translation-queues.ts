import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { BatchQueueConfig, RequestQueueConfig } from "@/types/config/translate"
import type { WebPagePromptContext } from "@/types/content"
import type { PromptResolver } from "@/utils/host/translate/api/ai"
import type { SerializableProviderRef } from "@/utils/providers/provider-ref"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { storage } from "#imports"
import { isLLMProviderConfig } from "@/types/config/provider"
import { putBatchRequestRecord } from "@/utils/batch-request-record"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { BATCH_SEPARATOR, BATCH_SEPARATOR_LINE_PATTERN } from "@/utils/constants/prompt"
import {
  BATCH_TIMEOUT_BASE_MS,
  BATCH_TIMEOUT_PER_CHAR_MS,
  MAX_BATCH_TIMEOUT_MS,
} from "@/utils/constants/translate"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { logger } from "@/utils/logger"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { BatchQueue } from "@/utils/request/batch-queue"
import { CancelledScopeRegistry } from "@/utils/request/cancellation"
import { RequestQueue } from "@/utils/request/request-queue"
import { runStreamTextInBackground } from "./background-stream"
import { ensureInitializedConfig } from "./config"

type QueuedTranslationProvider = ProviderConfig | SerializableProviderRef

function isSerializedPageProvider(
  provider: QueuedTranslationProvider,
): provider is SerializableProviderRef {
  return "kind" in provider && (provider.kind === "local" || provider.kind === "system")
}

export function getLocalProviderConfig(provider: QueuedTranslationProvider): ProviderConfig | null {
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

export function createWebPageTranslationQueues() {
  // Scopes whose cancel already drained the queues. Consulted by (a) the
  // enqueue handler after its cache-lookup await and (b) the batch queue's
  // retry/fallback path after its backoff sleep — both are windows where a
  // request lives in NO cancellable structure, so a cancel arriving there
  // would otherwise be lost (#1881).
  const cancelledScopes = new CancelledScopeRegistry()

  const webPromptResolver: PromptResolver<WebPagePromptContext> = getTranslatePrompt

  const queuesPromise = loadQueueSetupConfig("webpage", selectWebPageQueueConfig).then(
    ({ requestQueueConfig, batchQueueConfig, configSource }) =>
      createTranslationQueues<WebPagePromptContext>({
        requestQueueConfig,
        batchQueueConfig,
        promptResolver: webPromptResolver,
        isScopeCancelled: (scopeKey) => cancelledScopes.has(scopeKey),
        queueName: "webpage",
        hostedFeature: "pageTranslation",
        configSource,
      }),
  )

  watchQueueConfig("webpage", queuesPromise, selectWebPageQueueConfig)

  return { queuesPromise, cancelledScopes }
}

const selectSubtitlesQueueConfig = (config: Config) => ({
  requestQueueConfig: config.videoSubtitles.requestQueueConfig,
  batchQueueConfig: config.videoSubtitles.batchQueueConfig,
})

/**
 * Create subtitle translation queues and watch their configuration
 */
export function createSubtitlesTranslationQueues() {
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

  return queuesPromise
}
