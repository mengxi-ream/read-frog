import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { NO_TRANSLATION_SENTINEL } from "@/utils/constants/prompt"

const onMessageMock = vi.fn<(...args: any[]) => any>()
const ensureInitializedConfigMock = vi.fn<(...args: any[]) => any>()
const executeTranslateMock = vi.fn<(...args: any[]) => any>()
const generateArticleSummaryMock = vi.fn<(...args: any[]) => any>()
const putBatchRequestRecordMock = vi.fn<(...args: any[]) => any>()
const articleSummaryCacheGetMock = vi.fn<(...args: any[]) => any>()
const articleSummaryCachePutMock = vi.fn<(...args: any[]) => any>()
const translationCacheGetMock = vi.fn<(...args: any[]) => any>()
const translationCachePutMock = vi.fn<(...args: any[]) => any>()
const translationCacheDeleteMock = vi.fn<(...args: any[]) => any>()

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

function getRegisteredMessageHandler(name: string) {
  const registration = onMessageMock.mock.calls.find((call) => call[0] === name)
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
    translationCacheDeleteMock.mockResolvedValue(undefined)
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
  }, 15_000)

  it("keeps request-local marker zero isolated across LLM batch items", async () => {
    ensureInitializedConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
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
    await setUpWebPageTranslationQueue()
    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")

    const results = await Promise.all([
      handler({
        data: {
          text: `<span data-rf-attr="0">Hello</span>`,
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
          scheduleAt: Date.now(),
          hash: "marker-batch-one",
          textFormat: "html",
        },
      }),
      handler({
        data: {
          text: `<a data-rf-attr="0">Read</a>`,
          langConfig: DEFAULT_CONFIG.language,
          providerConfig: llmProvider,
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

    expect(result).toBe("Tom &amp; Jerry — It's on https://example.com/?page=1&copy=true <span>")
    expect(executeTranslateMock).not.toHaveBeenCalled()
    expect(translationCachePutMock).not.toHaveBeenCalled()
  })

  it("returns and caches fresh Google translations verbatim without re-decoding", async () => {
    executeTranslateMock.mockResolvedValue("write &amp; for ampersand — It's fine")

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

    expect(result).toBe("write &amp; for ampersand — It's fine")
    expect(translationCachePutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "webpage-hash",
        translation: "write &amp; for ampersand — It's fine",
      }),
    )
  })

  it("uses cached HTML translations when all attribute markers remain on their tags", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "webpage-hash",
      translation: `<a data-rf-attr="1">Lire</a><span data-rf-attr="0">Bonjour</span>`,
    })

    const { setUpWebPageTranslationQueue } = await import("../translation-queues")
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span><a data-rf-attr="1">Read</a>`,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `<span data-rf-attr="rf-page-0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const request = handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const request = handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const request = handler({
      data: {
        text: `<span data-rf-attr="0">Hello</span><a data-rf-attr="0">Read</a>`,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: `Explain <span data-rf-attr="0">this example</span>`,
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    const result = await handler({
      data: {
        text: "already in target language",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpWebPageTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueTranslateRequest")
    await handler({
      data: {
        text: "<b>hello</b>",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
      { textFormat: "html" },
    )
  })

  it("returns cached Google subtitle translations verbatim without re-decoding", async () => {
    translationCacheGetMock.mockResolvedValueOnce({
      key: "subtitle-hash",
      translation: "Tom &amp; Jerry — It's a subtitle",
    })

    const { setUpSubtitlesTranslationQueue } = await import("../translation-queues")
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    await setUpSubtitlesTranslationQueue()

    const handler = getRegisteredMessageHandler("enqueueSubtitlesTranslateRequest")
    const result = await handler({
      data: {
        text: "hello",
        langConfig: DEFAULT_CONFIG.language,
        providerConfig: googleProvider,
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
    expect(generateArticleSummaryMock).toHaveBeenCalledWith("Page title", "page body", llmProvider)
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
      () =>
        new Promise((resolve: (summary: string) => void) => {
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
})
