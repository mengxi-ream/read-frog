import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { NO_TRANSLATION_SENTINEL } from "@/utils/constants/prompt"
import { isTranslationCancelledError } from "@/utils/request/cancellation"

const onMessageMock = vi.fn<(...args: any[]) => any>()
const ensureInitializedConfigMock = vi.fn<(...args: any[]) => any>()
const executeTranslateMock = vi.fn<(...args: any[]) => any>()
const generateArticleSummaryMock = vi.fn<(...args: any[]) => any>()
const generateTextForProviderRefMock = vi.fn<(...args: any[]) => any>()
const putBatchRequestRecordMock = vi.fn<(...args: any[]) => any>()
const articleSummaryCacheGetMock = vi.fn<(...args: any[]) => any>()
const articleSummaryCachePutMock = vi.fn<(...args: any[]) => any>()
const translationCacheGetMock = vi.fn<(...args: any[]) => any>()
const translationCachePutMock = vi.fn<(...args: any[]) => any>()
const translationCacheDeleteMock = vi.fn<(...args: any[]) => any>()
const runStreamTextInBackgroundMock = vi.fn<(...args: any[]) => any>()
const getTranslatePromptMock = vi.fn<(...args: any[]) => any>()

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
      delete: translationCacheDeleteMock,
      get: translationCacheGetMock,
      put: translationCachePutMock,
    },
  },
}))

vi.mock("../background-stream", () => ({
  runStreamTextInBackground: runStreamTextInBackgroundMock,
  generateTextForProviderRef: generateTextForProviderRefMock,
}))

// Partial: the subtitles prompt builder pulls resolvePromptReplacementValue
// from this module, and the hosted path runs the real builder.
vi.mock("@/utils/prompts/translate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/prompts/translate")>()),
  getTranslatePrompt: getTranslatePromptMock,
}))

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find((call) => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }
  const handler: unknown = registration[1]
  if (typeof handler !== "function") {
    throw new Error(`Registered message handler is not callable: ${name}`)
  }

  return async (message: {
    data: Record<string, unknown>
    sender?: { tab?: { id?: number } }
  }): Promise<unknown> => await handler(message)
}

function localProviderRef(config: ProviderConfig) {
  return { kind: "local" as const, config }
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

const deepLProvider: ProviderConfig = {
  id: "deepl-default",
  name: "DeepL",
  provider: "deepl",
  enabled: true,
  apiKey: "test-key",
}

describe("translation queue helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
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
    translationCacheDeleteMock.mockResolvedValue(undefined)
    runStreamTextInBackgroundMock.mockResolvedValue({
      output: "hosted translation",
      thinking: { status: "complete", text: "" },
    })
    getTranslatePromptMock.mockResolvedValue({
      systemPrompt: "Translate accurately",
      prompt: "Source text",
    })
  })

  it("routes only llm providers through the batch queue", async () => {
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
    expect(
      shouldUseBatchQueue({
        kind: "system",
        providerId: "read-frog-free-ai",
        modelTier: "normal",
        modelRevision: "normal-r1",
      }),
    ).toBe(true)
  }, 15_000)

  it("reuses the hosted requestId when RequestQueue retries the same model call", async () => {
    runStreamTextInBackgroundMock
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        output: "hosted translation",
        thinking: { status: "complete", text: "" },
      })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()
    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")

    await expect(
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerRef: {
            kind: "system",
            providerId: "read-frog-free-ai",
            modelTier: "normal",
            modelRevision: "normal-r1",
          },
          scheduleAt: Date.now(),
          hash: "hosted-retry-hash",
        },
      }),
    ).resolves.toBe("hosted translation")

    expect(runStreamTextInBackgroundMock).toHaveBeenCalledTimes(2)
    const firstPayload = runStreamTextInBackgroundMock.mock.calls[0]![0]
    const secondPayload = runStreamTextInBackgroundMock.mock.calls[1]![0]
    expect(firstPayload).toMatchObject({
      providerId: "read-frog-free-ai",
      modelTier: "normal",
      instructions: "Translate accurately",
      prompt: "Source text",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    })
    expect(secondPayload.requestId).toBe(firstPayload.requestId)
    expect(putBatchRequestRecordMock).not.toHaveBeenCalled()
  }, 5_000)

  it("routes hosted tasks through the shared user-configured request queue", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        requestQueueConfig: { rate: 0.1, capacity: 1 },
        batchQueueConfig: { maxCharactersPerBatch: 1000, maxItemsPerBatch: 1 },
      },
    })
    const abortSignals: (AbortSignal | undefined)[] = []
    runStreamTextInBackgroundMock.mockImplementation(
      (_payload: unknown, options?: { signal?: AbortSignal }) => {
        abortSignals.push(options?.signal)
        return new Promise(() => {})
      },
    )

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()
    const enqueue = getRegisteredMessageHandler("enqueueTranslateRequest")
    const cancel = getRegisteredMessageHandler("cancelPageTranslationRequests")

    const sender = { tab: { id: 7 } }
    const requests = ["shared-queue-one", "shared-queue-two"].map((hash) =>
      enqueue({
        data: {
          text: `text for ${hash}`,
          langConfig: DEFAULT_CONFIG.language,
          providerRef: {
            kind: "system",
            providerId: "read-frog-free-ai",
            modelTier: "normal",
            modelRevision: "normal-r1",
          },
          scheduleAt: Date.now(),
          hash,
          sessionId: "session-a",
        },
        sender,
      }),
    )
    for (const request of requests) request.catch(() => {})

    // capacity 1 admits exactly one in-flight hosted call; the second waits
    // ~10s (rate 0.1) for the next token. The former dedicated hosted queue
    // (rate 2 / capacity 2) would have started both immediately.
    await vi.waitFor(() => expect(runStreamTextInBackgroundMock).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(runStreamTextInBackgroundMock).toHaveBeenCalledTimes(1)

    await cancel({ data: { sessionId: "session-a" }, sender })

    const settled = await Promise.allSettled(requests)
    expect(settled.map((result) => result.status)).toEqual(["rejected", "rejected"])
    const cancelledReasons = settled.map(
      (result) => result.status === "rejected" && isTranslationCancelledError(result.reason),
    )
    expect(cancelledReasons).toEqual([true, true])
    expect(abortSignals[0]?.aborted).toBe(true)
  }, 5_000)

  it("keeps request-local marker zero isolated across LLM batch items", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        providerId: llmProvider.id,
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 10,
        },
      },
    })
    executeTranslateMock.mockResolvedValueOnce(
      `<span data-rf-attr="0">Bonjour</span>\n\n%%\n\n<a data-rf-attr="0">Lire</a>`,
    )

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()
    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")

    const results = await Promise.all([
      handler({
        data: {
          text: `<span data-rf-attr="0">Hello</span>`,
          langConfig: DEFAULT_CONFIG.language,
          providerRef: localProviderRef(llmProvider),
          scheduleAt: Date.now(),
          hash: "marker-batch-one",
          textFormat: "html",
        },
      }),
      handler({
        data: {
          text: `<a data-rf-attr="0">Read</a>`,
          langConfig: DEFAULT_CONFIG.language,
          providerRef: localProviderRef(llmProvider),
          scheduleAt: Date.now(),
          hash: "marker-batch-two",
          textFormat: "html",
        },
      }),
    ])

    expect(results).toEqual([
      `<span data-rf-attr="0">Bonjour</span>`,
      `<a data-rf-attr="0">Lire</a>`,
    ])
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
    expect(executeTranslateMock).toHaveBeenCalledWith(
      `<span data-rf-attr="0">Hello</span>\n\n%%\n\n<a data-rf-attr="0">Read</a>`,
      DEFAULT_CONFIG.language,
      llmProvider,
      expect.any(Function),
      expect.objectContaining({ isBatch: true }),
    )
  })

  it("coalesces concurrent identical translate requests into one provider call", async () => {
    executeTranslateMock.mockResolvedValue("translated")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()
    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")

    const makeRequest = () =>
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerRef: localProviderRef(llmProvider),
          scheduleAt: Date.now(),
          hash: "same-request-hash",
        },
      })

    // both requests arrive before the first result lands in the translation cache
    const results = await Promise.all([makeRequest(), makeRequest()])

    expect(results).toEqual(["translated", "translated"])
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
    // the shared item is sent once, not as a two-item batch
    expect(executeTranslateMock.mock.calls[0]![0]).toBe("hello")
  })

  it("returns a cached LLM translation without calling the provider", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "llm-cache-hit",
      translation: "cached translation",
    })
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()
    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")

    await expect(
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerRef: localProviderRef(llmProvider),
          scheduleAt: Date.now(),
          hash: "llm-cache-hit",
        },
      }),
    ).resolves.toBe("cached translation")

    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("passes subtitle summary through the translation queue without generating a new summary", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: { kind: "local" as const, config: llmProvider },
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
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
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
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const requests = [
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerRef: { kind: "local" as const, config: llmProvider },
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
          providerRef: { kind: "local" as const, config: llmProvider },
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
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(llmProvider),
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

  // Cached values are already decoded once by executeTranslate; a second decode
  // would corrupt legitimate entity mentions ("Tom &amp; Jerry" -> "Tom & Jerry").
  // The fixtures below intentionally contain semicolon-terminated entities so a
  // re-introduced decode call fails these tests.
  it("returns cached Google translations verbatim without re-decoding", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: "Tom &amp; Jerry — It's on https://example.com/?page=1&copy=true <span>",
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
      },
    })

    expect(result).toBe("Tom &amp; Jerry — It's on https://example.com/?page=1&copy=true <span>")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("bypasses a cached value and replaces the same key after forced translation succeeds", async () => {
    translationCacheGetMock.mockResolvedValue({
      key: "webpage-hash",
      translation: "stale translation",
    })
    executeTranslateMock.mockResolvedValue("fresh translation")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()
    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")

    await expect(
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerRef: localProviderRef(googleProvider),
          scheduleAt: Date.now(),
          hash: "webpage-hash",
          forceRetranslation: true,
        },
      }),
    ).resolves.toBe("fresh translation")

    expect(translationCacheGetMock).not.toHaveBeenCalled()
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "webpage-hash",
        translation: "fresh translation",
      }),
    )
  })

  it("preserves the previous cache entry when forced translation fails", async () => {
    translationCacheGetMock.mockResolvedValue({
      key: "webpage-hash",
      translation: "still usable",
    })
    executeTranslateMock.mockReset().mockRejectedValue(new Error("provider unavailable"))

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()
    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")

    await expect(
      handler({
        data: {
          text: "hello",
          langConfig: DEFAULT_CONFIG.language,
          providerRef: localProviderRef(googleProvider),
          scheduleAt: Date.now(),
          hash: "webpage-hash",
          forceRetranslation: true,
        },
      }),
    ).rejects.toThrow("provider unavailable")

    expect(translationCacheGetMock).not.toHaveBeenCalled()
    expect(translationCacheDeleteMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("returns and caches fresh Google translations verbatim without re-decoding", async () => {
    executeTranslateMock.mockResolvedValue("write &amp; for ampersand — It's fine")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
      },
    })

    expect(result).toBe("write &amp; for ampersand — It's fine")
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "webpage-hash",
        translation: "write &amp; for ampersand — It's fine",
      }),
    )
  })

  it("caches a translation whose inline atom placeholders all came back", async () => {
    executeTranslateMock.mockResolvedValue("设 {{1}} 大于 {{0}}。")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "Let {{0}} be smaller than {{1}}.",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "atom-hash",
      },
    })

    expect(result).toBe("设 {{1}} 大于 {{0}}。")
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: "atom-hash", translation: "设 {{1}} 大于 {{0}}。" }),
    )
  })

  it("returns but does not cache a translation that lost an inline atom placeholder", async () => {
    executeTranslateMock.mockResolvedValue("设 {{0}} 大于。")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "Let {{0}} be smaller than {{1}}.",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "atom-hash",
      },
    })

    expect(result).toBe("设 {{0}} 大于。")
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("uses cached HTML translations when all attribute markers remain on their tags", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: `<a data-rf-attr="1">Lire</a><span data-rf-attr="0">Bonjour</span>`,
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span><a data-rf-attr="1">Read</a>`,
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
        textFormat: "html",
      },
    })

    expect(result).toBe(`<a data-rf-attr="1">Lire</a><span data-rf-attr="0">Bonjour</span>`)
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCacheDeleteMock).not.toHaveBeenCalled()
  })

  it("deletes an invalid cached HTML translation and replaces it with a valid fresh result", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: `<span>Bonjour</span>`,
    })
    executeTranslateMock.mockResolvedValueOnce(`<span data-rf-attr="0">Bonjour</span>`)

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
        textFormat: "html",
      },
    })

    expect(result).toBe(`<span data-rf-attr="0">Bonjour</span>`)
    expect(translationCacheDeleteMock).toHaveBeenCalledWith("webpage-hash")
    expect(executeTranslateMock).toHaveBeenCalledTimes(1)
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "webpage-hash",
        translation: `<span data-rf-attr="0">Bonjour</span>`,
      }),
    )
  })

  it("validates escaped page-marker fallback results before using or caching them", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "legacy-marker-hash",
      translation: `<span>Cached without the protected page attribute</span>`,
    })
    executeTranslateMock.mockResolvedValueOnce(
      `<span data-rf-attr="rf-page-0">Fresh translation</span>`,
    )

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `<span data-rf-attr="rf-page-0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "legacy-marker-hash",
        textFormat: "html",
      },
    })

    expect(result).toBe(`<span data-rf-attr="rf-page-0">Fresh translation</span>`)
    expect(translationCacheDeleteMock).toHaveBeenCalledWith("legacy-marker-hash")
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "legacy-marker-hash",
        translation: `<span data-rf-attr="rf-page-0">Fresh translation</span>`,
      }),
    )
  })

  it("throws and does not cache a fresh translation with invalid HTML markers", async () => {
    executeTranslateMock.mockResolvedValueOnce(`<div data-rf-attr="0">Bonjour</div>`)

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const request = handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
        textFormat: "html",
      },
    })

    await expect(request).rejects.toMatchObject({
      code: "HTML_ATTR_MARKER_INTEGRITY",
      reason: "wrong-output-tag",
    })
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("treats an empty provider result as a missing-marker integrity failure", async () => {
    executeTranslateMock.mockResolvedValueOnce("")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const request = handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "empty-html-result",
        textFormat: "html",
      },
    })

    await expect(request).rejects.toMatchObject({
      code: "HTML_ATTR_MARKER_INTEGRITY",
      reason: "missing-output-marker",
    })
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("rejects duplicate input marker IDs before reading the cache or translating", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const request = handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span><a data-rf-attr="0">Read</a>`,
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
        textFormat: "html",
      },
    })

    await expect(request).rejects.toMatchObject({
      code: "HTML_ATTR_MARKER_INTEGRITY",
      reason: "duplicate-input-marker",
    })
    expect(translationCacheGetMock).not.toHaveBeenCalled()
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCacheDeleteMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("does not treat marker-shaped plain text as the translationOnly HTML protocol", async () => {
    executeTranslateMock.mockResolvedValueOnce("translated plain text")

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `Explain <span data-rf-attr="0">this example</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "plain-marker-shaped-text",
        textFormat: "plain",
      },
    })

    expect(result).toBe("translated plain text")
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "plain-marker-shaped-text",
        translation: "translated plain text",
      }),
    )
  })

  it("returns and caches the no-translation sentinel RAW (mapping is content-side)", async () => {
    executeTranslateMock.mockResolvedValue(NO_TRANSLATION_SENTINEL)

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "already in target language",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "sentinel-hash",
      },
    })

    // Mapping the sentinel to "" here would fall out of the truthy-only cache
    // write and re-hit the provider on every request; translateTextCore maps it.
    expect(result).toBe(NO_TRANSLATION_SENTINEL)
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "sentinel-hash",
        translation: NO_TRANSLATION_SENTINEL,
      }),
    )
  })

  it("forwards the textFormat to executeTranslate for non-batch providers", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    await handler({
      data: {
        text: "<b>hello</b>",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(googleProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
        textFormat: "html",
      },
    })

    expect(executeTranslateMock).toHaveBeenCalledWith(
      "<b>hello</b>",
      DEFAULT_CONFIG.language,
      googleProvider,
      expect.any(Function),
      { textFormat: "html", signal: expect.any(AbortSignal) },
    )
  })

  it("returns cached Google subtitle translations verbatim without re-decoding", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "subtitle-hash",
      translation: "Tom &amp; Jerry — It's a subtitle",
    })

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: { kind: "local" as const, config: googleProvider },
        scheduleAt: Date.now(),
        hash: "subtitle-hash",
      },
    })

    expect(result).toBe("Tom &amp; Jerry — It's a subtitle")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("returns and caches fresh Google subtitle translations verbatim without re-decoding", async () => {
    executeTranslateMock.mockResolvedValue("write &amp; for ampersand — It's a subtitle")

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: { kind: "local" as const, config: googleProvider },
        scheduleAt: Date.now(),
        hash: "subtitle-hash",
      },
    })

    expect(result).toBe("write &amp; for ampersand — It's a subtitle")
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "subtitle-hash",
        translation: "write &amp; for ampersand — It's a subtitle",
      }),
    )
  })

  it("does not normalize cached non-Google translations", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: "A&amp;B",
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: localProviderRef(deepLProvider),
        scheduleAt: Date.now(),
        hash: "webpage-hash",
      },
    })

    expect(result).toBe("A&amp;B")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("bills hosted subtitle translations against videoSubtitles, not page translation", async () => {
    // The queue's route was briefly declared but never threaded through, which
    // would have billed every subtitle line to the page-translation quota.
    runStreamTextInBackgroundMock.mockResolvedValue({ output: "译文" })
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: {
          kind: "system" as const,
          providerId: "read-frog-advance-ai",
          modelTier: "advance",
          modelRevision: "advance-r1",
        },
        scheduleAt: Date.now(),
        hash: "subtitle-hosted-hash",
      },
    })

    expect(runStreamTextInBackgroundMock).toHaveBeenCalledWith(
      expect.objectContaining({ hostedFeature: "videoSubtitles" }),
      expect.anything(),
    )
  })

  it("bills a hosted request against the route it carries, not the queue default", async () => {
    // Input translation shares the webpage queue; without the per-request
    // route it would bill the page-translation quota it never gated on.
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerRef: {
          kind: "system" as const,
          providerId: "read-frog-free-ai",
          modelTier: "normal",
          modelRevision: "normal-r1",
        },
        scheduleAt: Date.now(),
        hash: "hosted-input-route-hash",
        hostedFeature: "inputTranslation",
      },
    })

    expect(runStreamTextInBackgroundMock).toHaveBeenCalledWith(
      expect.objectContaining({ hostedFeature: "inputTranslation" }),
      expect.anything(),
    )
  })

  it("keeps requests for different hosted routes in separate billing batches", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        batchQueueConfig: { maxCharactersPerBatch: 1000, maxItemsPerBatch: 4 },
      },
    })
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const base = {
      langConfig: DEFAULT_CONFIG.language,
      providerRef: {
        kind: "system" as const,
        providerId: "read-frog-free-ai",
        modelTier: "normal",
        modelRevision: "normal-r1",
      },
      scheduleAt: Date.now(),
    }
    await Promise.all([
      handler({ data: { ...base, text: "page paragraph", hash: "route-batch-page-hash" } }),
      handler({
        data: {
          ...base,
          text: "typed input",
          hash: "route-batch-input-hash",
          hostedFeature: "inputTranslation",
        },
      }),
    ])

    // A batch bills as one unit, so the route is part of the batch key: one
    // merged batch here would bill the input request to the page quota.
    expect(runStreamTextInBackgroundMock).toHaveBeenCalledTimes(2)
    const billedFeatures = runStreamTextInBackgroundMock.mock.calls
      .map((call) => (call[0] as { hostedFeature?: string }).hostedFeature)
      .sort((a, b) => (a ?? "").localeCompare(b ?? ""))
    expect(billedFeatures).toEqual(["inputTranslation", "pageTranslation"])
  })

  it("bills the webpage summary against the sender's route and stamps an idempotency key", async () => {
    generateTextForProviderRefMock.mockResolvedValue("hosted summary")
    generateArticleSummaryMock.mockImplementation(
      async (
        _title: string,
        _text: string,
        providerRef: unknown,
        options: {
          hostedFeature: string
          generate: (payload: unknown, runOptions: unknown) => Promise<string>
        },
      ) =>
        options.generate(
          {
            providerRef,
            hostedFeature: options.hostedFeature,
            instructions: "sys",
            prompt: "user",
          },
          { signal: undefined },
        ),
    )
    const hostedRef = {
      kind: "system" as const,
      providerId: "read-frog-advance-ai",
      modelTier: "advance",
      modelRevision: "advance-r1",
    }
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("getOrGenerateWebPageSummary")
    const result = await handler({
      data: {
        webTitle: "Page title",
        webContent: "page body",
        providerRef: hostedRef,
        hostedFeature: "inputTranslation",
      },
    })

    expect(result).toBe("hosted summary")
    // The summary is a sub-call of the triggering feature: gate (content side)
    // and billing (here) must name the same route.
    expect(generateArticleSummaryMock).toHaveBeenCalledWith(
      "Page title",
      "page body",
      hostedRef,
      expect.objectContaining({ hostedFeature: "inputTranslation" }),
    )
    expect(generateTextForProviderRefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        hostedFeature: "inputTranslation",
        requestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i),
      }),
      expect.anything(),
    )
  })

  it("exposes webpage summary generation as a separate background handler", async () => {
    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("getOrGenerateWebPageSummary")
    const result = await handler({
      data: {
        webTitle: "Page title",
        webContent: "page body",
        providerRef: { kind: "local" as const, config: llmProvider },
      },
    })

    expect(result).toBe("Generated summary")
    expect(generateArticleSummaryMock).toHaveBeenCalledWith(
      "Page title",
      "page body",
      { kind: "local", config: llmProvider },
      expect.objectContaining({
        hostedFeature: "pageTranslation",
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("exposes subtitle summary generation as a separate background handler", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerRef: { kind: "local" as const, config: llmProvider },
      },
    })

    expect(result).toBe("Generated summary")
    expect(generateArticleSummaryMock).toHaveBeenCalledWith(
      "Video title",
      "subtitle transcript",
      { kind: "local", config: llmProvider },
      expect.objectContaining({
        hostedFeature: "videoSubtitles",
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("refuses a summary for a provider with no model to prompt", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    // Google is a legal videoSubtitles provider — the capability admits any
    // translate provider — but it cannot be prompted. Admitting this to the
    // queue means a task that throws and burns its retries at the start of
    // every video.
    const result = await handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerRef: { kind: "local" as const, config: googleProvider },
      },
    })

    expect(result).toBeNull()
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
  })

  it("returns null for invalid subtitle summary requests", async () => {
    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "",
        subtitlesContext: "subtitle transcript",
        providerRef: { kind: "local" as const, config: llmProvider },
      },
    })

    expect(result).toBeNull()
    expect(generateArticleSummaryMock).not.toHaveBeenCalled()
  })

  it("returns null when subtitle summary generation has no result", async () => {
    generateArticleSummaryMock.mockResolvedValue(null)

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const result = await handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerRef: { kind: "local" as const, config: llmProvider },
      },
    })

    expect(result).toBeNull()
  })

  it("deduplicates concurrent subtitle summary generation requests", async () => {
    let resolveSummary: ((summary: string) => void) | undefined
    generateArticleSummaryMock.mockImplementation(
      () =>
        new Promise((resolve: (summary: string) => void) => {
          resolveSummary = resolve
        }),
    )

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("getSubtitlesSummary")
    const firstRequest = handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerRef: { kind: "local" as const, config: llmProvider },
      },
    })
    const secondRequest = handler({
      data: {
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerRef: { kind: "local" as const, config: llmProvider },
      },
    })

    // The handler chain awaits queue init + cache lookups before the summary
    // thunk runs; poll until the mock's resolver is captured.
    for (let i = 0; i < 100; i++) {
      if (resolveSummary) break
      await Promise.resolve()
    }
    resolveSummary!("Generated summary")

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      "Generated summary",
      "Generated summary",
    ])
    expect(generateArticleSummaryMock).toHaveBeenCalledTimes(1)
  })
})
