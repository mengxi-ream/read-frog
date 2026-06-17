import type { ProviderConfig } from "@/types/config/provider"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const onMessageMock = vi.fn()
const ensureInitializedConfigMock = vi.fn()
const executeTranslateMock = vi.fn()
const generateArticleSummaryMock = vi.fn()
const putBatchRequestRecordMock = vi.fn()
const articleSummaryCacheGetMock = vi.fn()
const articleSummaryCachePutMock = vi.fn()
const translationCacheGetMock = vi.fn()
const translationCachePutMock = vi.fn()

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
}))

vi.mock("../config", () => ({
  ensureInitializedConfig: ensureInitializedConfigMock,
}))

vi.mock("@/utils/host/translate/execute-translate", () => ({
  executeTranslate: executeTranslateMock,
}))

vi.mock("@/utils/content/summary", () => ({
  generateArticleSummary: generateArticleSummaryMock,
}))

vi.mock("@/utils/batch-request-record", () => ({
  putBatchRequestRecord: putBatchRequestRecordMock,
}))

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    articleSummaryCache: {
      get: articleSummaryCacheGetMock,
      put: articleSummaryCachePutMock,
    },
    translationCache: {
      get: translationCacheGetMock,
      put: translationCachePutMock,
    },
  },
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find(call => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }
  return registration[1] as (message: { data: Record<string, unknown> }) => Promise<unknown>
}

const llmProvider: ProviderConfig = {
  id: "openai-default",
  name: "OpenAI",
  provider: "openai",
  enabled: true,
  apiKey: "sk-test",
  model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
}

const googleProvider: ProviderConfig = {
  id: "google-translate-default",
  name: "Google Translate",
  provider: "google-translate",
  enabled: true,
}

const microsoftProvider: ProviderConfig = {
  id: "microsoft-translate-default",
  name: "Microsoft Translate",
  provider: "microsoft-translate",
  enabled: true,
}

describe("translation queue helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: llmProvider.id,
        requestQueueConfig: {
          rate: 10,
          capacity: 10,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 1,
        },
      },
    })

    executeTranslateMock.mockResolvedValue("translated subtitle")
    generateArticleSummaryMock.mockResolvedValue("Generated summary")
    putBatchRequestRecordMock.mockResolvedValue(undefined)
    articleSummaryCacheGetMock.mockResolvedValue(undefined)
    articleSummaryCachePutMock.mockResolvedValue(undefined)
    translationCacheGetMock.mockResolvedValue(undefined)
    translationCachePutMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it(
    "routes only llm providers through the batch queue",
    async () => {
      const { shouldUseBatchQueue } = await import("../translation-queues")

      const deeplProvider: ProviderConfig = {
        id: "deepl",
        name: "DeepL",
        provider: "deepl",
        enabled: true,
        apiKey: "key",
      }

      const deeplxProvider: ProviderConfig = {
        id: "deeplx",
        name: "DeepLX",
        provider: "deeplx",
        enabled: true,
        baseURL: "https://api.deeplx.org",
      }

      expect(shouldUseBatchQueue(deeplProvider)).toBe(false)
      expect(shouldUseBatchQueue(deeplxProvider)).toBe(false)
      expect(shouldUseBatchQueue(llmProvider)).toBe(true)
    },
    15_000,
  )

  it("passes subtitle summary through the translation queue without generating a new summary", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "subtitle-hash",
        webTitle: "Video title",
        webDescription: "Video description",
        summary: "Ready summary",
      },
    })

    expect(result).toBe("translated subtitle")
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
    expect(executeTranslateMock).toHaveBeenCalledWith(
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        isBatch: true,
        context: {
          webTitle: "Video title",
          webDescription: "Video description",
          videoSummary: "Ready summary",
        },
      }),
    )
  })

  it("keeps subtitle translations with different video context in separate batches", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: llmProvider.id,
        requestQueueConfig: {
          rate: 10,
          capacity: 10,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 10,
        },
      },
    })

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const requests = [
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "subtitle-hash-one",
          webTitle: "First video",
          webDescription: "First description",
        },
      }),
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "subtitle-hash-two",
          webTitle: "Second video",
          webDescription: "Second description",
        },
      }),
    ]

    await expect(Promise.all(requests)).resolves.toEqual([
      "translated subtitle",
      "translated subtitle",
    ])
    expect(executeTranslateMock).toHaveBeenCalledTimes(2)
    expect(executeTranslateMock).toHaveBeenNthCalledWith(
      1,
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        isBatch: true,
        context: expect.objectContaining({
          webTitle: "First video",
          webDescription: "First description",
        }),
      }),
    )
    expect(executeTranslateMock).toHaveBeenNthCalledWith(
      2,
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        isBatch: true,
        context: expect.objectContaining({
          webTitle: "Second video",
          webDescription: "Second description",
        }),
      }),
    )
  })

  it("passes webpage context through the translation queue without generating a new summary", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "webpage-hash",
        webTitle: "Page title",
        webDescription: "Page description",
        webContent: "Page body",
        webSummary: "Ready summary",
      },
    })

    expect(result).toBe("translated subtitle")
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
    expect(executeTranslateMock).toHaveBeenCalledWith(
      "hello",
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({
        context: {
          webTitle: "Page title",
          webDescription: "Page description",
          webContent: "Page body",
          webSummary: "Ready summary",
        },
      }),
    )
  })

  it("normalizes cached Google translations before returning them", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: "L&#39;Iran chiama &quot;Dichiarazione&quot; &lt;span&gt;",
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
        scheduleAt: Date.now(),
        hash: "webpage-hash",
      },
    })

    expect(result).toBe("L'Iran chiama \"Dichiarazione\" <span>")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("does not normalize cached non-Google translations", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: "A&amp;B",
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: microsoftProvider,
        scheduleAt: Date.now(),
        hash: "webpage-hash",
      },
    })

    expect(result).toBe("A&amp;B")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("exposes webpage summary generation as a separate background handler", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("getOrGenerateWebPageSummary")
    const result = await handler({
      data: {
        webTitle: "Page title",
        webContent: "page body",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBe("Generated summary")
    expect(generateArticleSummaryMock).toHaveBeenCalledWith(
      "Page title",
      "page body",
      llmProvider,
    )
  })

  it("exposes subtitle summary generation as a separate background handler", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBe("Generated summary")
    expect(generateArticleSummaryMock).toHaveBeenCalledWith(
      "Video title",
      "subtitle transcript",
      llmProvider,
    )
  })

  it("returns null for invalid subtitle summary requests", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBeNull()
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
  })

  it("returns null when subtitle summary generation has no result", async () => {
    generateArticleSummaryMock.mockResolvedValue(null)

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    expect(result).toBeNull()
  })

  it("deduplicates concurrent subtitle summary generation requests", async () => {
    let resolveSummary!: (summary: string) => void
    generateArticleSummaryMock.mockImplementation(
      () => new Promise((resolve: (summary: string) => void) => {
        resolveSummary = resolve
      }),
    )

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const firstRequest = handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })
    const secondRequest = handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerConfig: llmProvider,
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    resolveSummary("Generated summary")

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      "Generated summary",
      "Generated summary",
    ])
    expect(generateArticleSummaryMock).toHaveBeenCalledTimes(1)
  })

  it("cancels pending subtitle translation requests in the same export group before flushing a batch", async () => {
    vi.useFakeTimers()
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: llmProvider.id,
        requestQueueConfig: {
          rate: 10,
          capacity: 10,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 10,
        },
      },
    })

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const enqueueHandler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const cancelHandler = getRegisteredMessageHandler("cancelSubtitlesTranslateRequestGroup")
    const request = enqueueHandler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "subtitle-hash",
        cancelGroupId: "export-group",
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await cancelHandler({ data: { cancelGroupId: "export-group" } })

    await expect(request).rejects.toThrow("Batch group cancelled: export-group")
    await vi.runAllTimersAsync()
    expect(executeTranslateMock).not.toHaveBeenCalled()
  })

  it("rejects late subtitle translation requests after their export group was already cancelled", async () => {
    vi.useFakeTimers()
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const enqueueHandler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const cancelHandler = getRegisteredMessageHandler("cancelSubtitlesTranslateRequestGroup")

    await cancelHandler({ data: { cancelGroupId: "export-group" } })
    const lateRequest = enqueueHandler({
      data: {
        text: "late request",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "late-subtitle-hash",
        cancelGroupId: "export-group",
      },
    })

    await expect(lateRequest).rejects.toThrow("Subtitles translation group cancelled: export-group")
    expect(translationCacheGetMock).not.toHaveBeenCalled()
    expect(executeTranslateMock).not.toHaveBeenCalled()
  })

  it("rejects subtitle translation requests cancelled while reading the translation cache", async () => {
    vi.useFakeTimers()
    let resolveCacheLookup!: (value: undefined) => void
    translationCacheGetMock.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => {
        resolveCacheLookup = resolve
      }),
    )

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const enqueueHandler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const cancelHandler = getRegisteredMessageHandler("cancelSubtitlesTranslateRequestGroup")
    const request = enqueueHandler({
      data: {
        text: "cache race request",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "cache-race-subtitle-hash",
        cancelGroupId: "export-group",
      },
    })

    await Promise.resolve()
    await cancelHandler({ data: { cancelGroupId: "export-group" } })
    resolveCacheLookup(undefined)

    await expect(request).rejects.toThrow("Subtitles translation group cancelled: export-group")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("forgets cancelled subtitle translation groups after the cancellation guard TTL", async () => {
    vi.useFakeTimers()
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const enqueueHandler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const cancelHandler = getRegisteredMessageHandler("cancelSubtitlesTranslateRequestGroup")

    await cancelHandler({ data: { cancelGroupId: "export-group" } })
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    const request = enqueueHandler({
      data: {
        text: "fresh request after ttl",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "fresh-subtitle-hash",
        cancelGroupId: "export-group",
      },
    })

    await expect(request).resolves.toBe("translated subtitle")
    expect(translationCacheGetMock).toHaveBeenCalledWith("fresh-subtitle-hash")
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
  })

  it("keeps different export groups and uncancellable subtitle requests running when one group is cancelled", async () => {
    vi.useFakeTimers()
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: llmProvider.id,
        requestQueueConfig: {
          rate: 10,
          capacity: 10,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 10,
        },
      },
    })

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const enqueueHandler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const cancelHandler = getRegisteredMessageHandler("cancelSubtitlesTranslateRequestGroup")
    const cancelledRequest = enqueueHandler({
      data: {
        text: "cancelled",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "cancelled-hash",
        cancelGroupId: "export-group",
      },
    })
    const otherGroupRequest = enqueueHandler({
      data: {
        text: "other group",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "other-group-hash",
        cancelGroupId: "other-group",
      },
    })
    const uncancellableRequest = enqueueHandler({
      data: {
        text: "playback",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "playback-hash",
      },
    })

    await Promise.resolve()
    await Promise.resolve()
    await cancelHandler({ data: { cancelGroupId: "export-group" } })
    await expect(cancelledRequest).rejects.toThrow("Batch group cancelled: export-group")
    await vi.runAllTimersAsync()

    await expect(otherGroupRequest).resolves.toBe("translated subtitle")
    await expect(uncancellableRequest).resolves.toBe("translated subtitle")
    expect(executeTranslateMock).toHaveBeenCalledTimes(2)
  })

  it("cancels an executing batched subtitle translation without waiting for the provider response", async () => {
    let finishProvider!: (value: string) => void
    executeTranslateMock.mockImplementation(
      () => new Promise((resolve: (value: string) => void) => {
        finishProvider = resolve
      }),
    )

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const enqueueHandler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const cancelHandler = getRegisteredMessageHandler("cancelSubtitlesTranslateRequestGroup")
    const request = enqueueHandler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: llmProvider,
        scheduleAt: Date.now(),
        hash: "subtitle-hash",
        cancelGroupId: "export-group",
      },
    })

    await vi.waitFor(() => expect(executeTranslateMock).toHaveBeenCalledTimes(1))
    await cancelHandler({ data: { cancelGroupId: "export-group" } })

    await expect(request).rejects.toThrow("Batch group cancelled: export-group")
    expect(translationCachePutMock).not.toHaveBeenCalled()

    finishProvider("late translated subtitle")
    await Promise.resolve()
  })

  it("cancels an executing non-batched subtitle translation in the same export group", async () => {
    let finishProvider!: (value: string) => void
    executeTranslateMock.mockImplementation(
      () => new Promise((resolve: (value: string) => void) => {
        finishProvider = resolve
      }),
    )

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const enqueueHandler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const cancelHandler = getRegisteredMessageHandler("cancelSubtitlesTranslateRequestGroup")
    const request = enqueueHandler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
        scheduleAt: Date.now(),
        hash: "google-subtitle-hash",
        cancelGroupId: "export-group",
      },
    })

    await vi.waitFor(() => expect(executeTranslateMock).toHaveBeenCalledTimes(1))
    await cancelHandler({ data: { cancelGroupId: "export-group" } })

    await expect(request).rejects.toThrow("Request group cancelled: export-group")
    expect(translationCachePutMock).not.toHaveBeenCalled()

    finishProvider("late translated subtitle")
    await Promise.resolve()
  })
})
