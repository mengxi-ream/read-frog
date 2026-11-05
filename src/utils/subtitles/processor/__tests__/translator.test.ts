import type { SerializableProviderRef } from "@/utils/providers/provider-ref"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const getLocalConfigMock = vi.fn<(...args: any[]) => any>()
const sendMessageMock = vi.fn<(...args: any[]) => any>()
const getSubtitlesTranslatePromptMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("@/utils/prompts/subtitles", () => ({
  getSubtitlesTranslatePrompt: getSubtitlesTranslatePromptMock,
}))

/**
 * The enqueue calls only. Translating a fragment also asks the background for
 * the glossary that applies to this page, so `sendMessage` call 0 is no longer
 * the translation request.
 */
function enqueueRequests() {
  return sendMessageMock.mock.calls
    .filter((call) => call[0] === "enqueueSubtitlesTranslateRequest")
    .map((call) => call[1])
}

describe("subtitles translator", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getLocalConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "openai-default",
      },
    })

    // Echoes the context into the prompt, so any page metadata that reached the
    // prompt the hash is taken over would show up as a different hash.
    getSubtitlesTranslatePromptMock.mockImplementation(async (_targetLang, input, options) => ({
      systemPrompt: `system ${JSON.stringify(options?.context ?? null)}`,
      prompt: `prompt ${input}`,
    }))
    sendMessageMock.mockResolvedValue("translated subtitle")
  })

  it("sends the summary with the request but keeps it out of the cache key", async () => {
    const { translateSubtitles } = await import("../translator")

    const fragments = [{ text: "hello", start: 0, end: 1_000 }]
    const baseContext = {
      videoTitle: "Video title",
      videoDescription: "Video description",
      subtitlesTextContent: "subtitle transcript",
    }

    // Before and after the asynchronous summary lands, as in the first and
    // second viewing of a video.
    await translateSubtitles(fragments, baseContext)
    await translateSubtitles(fragments, { ...baseContext, summary: "Ready summary" })

    const [beforeSummary, afterSummary] = enqueueRequests()

    expect(beforeSummary.webTitle).toBe("Video title")
    expect(beforeSummary.webDescription).toBe("Video description")
    expect(beforeSummary.subtitlesContext).toBeUndefined()
    expect(beforeSummary.summary).toBeUndefined()
    expect(afterSummary.webTitle).toBe("Video title")
    expect(afterSummary.webDescription).toBe("Video description")
    expect(afterSummary.subtitlesContext).toBeUndefined()
    expect(afterSummary.summary).toBe("Ready summary")
    expect(afterSummary.hash).toBe(beforeSummary.hash)
  })

  it("keys the cache on the transcript, not on the page title, description or summary", async () => {
    const { translateSubtitles } = await import("../translator")

    const fragments = [{ text: "hello", start: 0, end: 1_000 }]

    // First viewing, reached by an in-app navigation: YouTube still carries
    // the previous page's meta description, and the summary is not back yet.
    await translateSubtitles(fragments, {
      videoTitle: "(3) Video title - YouTube",
      videoDescription: "Enjoy the videos and music you love",
      subtitlesTextContent: "subtitle transcript",
    })
    // After a refresh: the video's own description, the cached summary.
    await translateSubtitles(fragments, {
      videoTitle: "Video title - YouTube",
      videoDescription: "What this video is about",
      subtitlesTextContent: "subtitle transcript",
      summary: "Ready summary",
    })
    // The translated-subtitles download: no description, summary awaited.
    await translateSubtitles(fragments, {
      videoTitle: "Video title - YouTube",
      subtitlesTextContent: "subtitle transcript",
      summary: "Ready summary",
    })
    // The same line in another video.
    await translateSubtitles(fragments, {
      videoTitle: "Video title - YouTube",
      videoDescription: "What this video is about",
      subtitlesTextContent: "another transcript",
      summary: "Ready summary",
    })

    const [firstVisit, afterRefresh, download, otherVideo] = enqueueRequests().map(
      (request) => request.hash,
    )

    expect(afterRefresh).toBe(firstVisit)
    expect(download).toBe(firstVisit)
    expect(otherVideo).not.toBe(firstVisit)
  })

  it("keeps the AI content awareness switch in the cache key", async () => {
    const { translateSubtitles } = await import("../translator")
    const fragments = [{ text: "hello", start: 0, end: 1_000 }]
    const videoContext = {
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
    }

    await translateSubtitles(fragments, videoContext)
    getLocalConfigMock.mockResolvedValueOnce({
      ...DEFAULT_CONFIG,
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, enableAIContentAware: false },
      videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: "openai-default" },
    })
    await translateSubtitles(fragments, videoContext)

    const [aware, unaware] = enqueueRequests().map((request) => request.hash)
    expect(unaware).not.toBe(aware)
  })

  it("scopes the cache key to the video when AI content awareness is off", async () => {
    const aiContentAwareOff = {
      ...DEFAULT_CONFIG,
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, enableAIContentAware: false },
      videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: "openai-default" },
    }
    getLocalConfigMock.mockResolvedValue(aiContentAwareOff)
    const { translateSubtitles } = await import("../translator")
    const fragments = [{ text: "hello", start: 0, end: 1_000 }]

    await translateSubtitles(fragments, {
      videoTitle: "(3) Video title - YouTube",
      subtitlesTextContent: "subtitle transcript",
    })
    await translateSubtitles(fragments, {
      videoTitle: "Video title - YouTube",
      subtitlesTextContent: "subtitle transcript",
    })
    await translateSubtitles(fragments, {
      videoTitle: "Video title - YouTube",
      subtitlesTextContent: "another transcript",
    })

    const [first, retitled, otherVideo] = enqueueRequests().map((request) => request.hash)
    expect(retitled).toBe(first)
    expect(otherVideo).not.toBe(first)
  })

  it("keeps the selected prompt template in the cache key", async () => {
    const { translateSubtitles } = await import("../translator")
    const fragments = [{ text: "hello", start: 0, end: 1_000 }]
    const videoContext = { videoTitle: "Video title", subtitlesTextContent: "subtitle transcript" }

    await translateSubtitles(fragments, videoContext)
    getSubtitlesTranslatePromptMock.mockImplementationOnce(async (_targetLang, input) => ({
      systemPrompt: "an edited custom prompt",
      prompt: `prompt ${input}`,
    }))
    await translateSubtitles(fragments, videoContext)

    const [original, edited] = enqueueRequests().map((request) => request.hash)
    expect(edited).not.toBe(original)
  })

  it("requests subtitle summary through a dedicated background message", async () => {
    sendMessageMock.mockResolvedValue("Generated summary")

    const { fetchSubtitlesSummary } = await import("../translator")
    const result = await fetchSubtitlesSummary({
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
    })

    expect(result).toBe("Generated summary")
    expect(sendMessageMock).toHaveBeenCalledWith(
      "getSubtitlesSummary",
      expect.objectContaining({
        videoTitle: "Video title",
        subtitlesContext: "subtitle transcript",
        providerRef: expect.objectContaining({
          kind: "local",
          config: expect.objectContaining({ id: "openai-default" }),
        }),
      }),
    )
  })

  it("returns null when subtitle summary is unavailable", async () => {
    const { fetchSubtitlesSummary } = await import("../translator")

    sendMessageMock.mockResolvedValueOnce(null)
    const emptyFromBackground = await fetchSubtitlesSummary({
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
    })

    expect(emptyFromBackground).toBeNull()

    getLocalConfigMock.mockResolvedValueOnce({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        enableAIContentAware: false,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "openai-default",
      },
    })

    const disabledResult = await fetchSubtitlesSummary({
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
    })

    expect(disabledResult).toBeNull()
  })

  it("preserves null summary once the subtitle summary fetch completes without data", async () => {
    const { translateSubtitles } = await import("../translator")

    await translateSubtitles([{ text: "hello", start: 0, end: 1_000 }], {
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
      summary: null,
    })

    const request = enqueueRequests()[0]
    expect(request.webTitle).toBe("Video title")
    expect(request.summary).toBeNull()
  })

  it("passes title and description when AI content awareness is disabled", async () => {
    getLocalConfigMock.mockResolvedValueOnce({
      ...DEFAULT_CONFIG,
      pageTranslation: {
        ...DEFAULT_CONFIG.pageTranslation,
        enableAIContentAware: false,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "openai-default",
      },
    })
    const { translateSubtitles } = await import("../translator")

    await translateSubtitles([{ text: "hello", start: 0, end: 1_000 }], {
      videoTitle: "Video title",
      videoDescription: "Video description",
      subtitlesTextContent: "subtitle transcript",
      summary: "Ready summary",
    })

    const request = enqueueRequests()[0]
    expect(request.webTitle).toBe("Video title")
    expect(request.webDescription).toBe("Video description")
    expect(request.summary).toBeUndefined()
    // The content script renders the prompt only to key the cache, and does so
    // without the page context; the background renders the real one.
    expect(getSubtitlesTranslatePromptMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ context: {} }),
    )
  })

  it("uses an explicit config snapshot without reading current settings again", async () => {
    const { fetchSubtitlesSummary, translateSubtitles } = await import("../translator")
    const configSnapshot = {
      ...DEFAULT_CONFIG,
      pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, enableAIContentAware: true },
      videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, providerId: "openai-default" },
    }
    const videoContext = { videoTitle: "Video title", subtitlesTextContent: "subtitle transcript" }

    await fetchSubtitlesSummary(videoContext, configSnapshot)
    await translateSubtitles(
      [{ text: "hello", start: 0, end: 1_000 }],
      videoContext,
      configSnapshot,
    )

    expect(getLocalConfigMock).not.toHaveBeenCalled()
    // Proves the snapshot's enableAIContentAware actually reached the guard —
    // without this, a snapshot that silently fails the first guard would make
    // the not-called assertion above pass vacuously.
    expect(sendMessageMock).toHaveBeenCalledWith(
      "getSubtitlesSummary",
      expect.objectContaining({ videoTitle: "Video title" }),
    )
    expect(sendMessageMock).toHaveBeenCalledWith(
      "enqueueSubtitlesTranslateRequest",
      expect.objectContaining({ langConfig: configSnapshot.language }),
    )
  })

  it("builds subtitle summary context hashes from subtitles text and provider config", async () => {
    const { buildSubtitlesSummaryContextHash } = await import("../translator")

    const baseProviderRef: SerializableProviderRef = {
      kind: "local",
      config: {
        id: "openai-default",
        name: "OpenAI",
        provider: "openai",
        enabled: true,
        apiKey: "sk-test",
        model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
      } as never,
    }

    const first = buildSubtitlesSummaryContextHash(
      {
        subtitlesTextContent: "same transcript",
      },
      baseProviderRef,
    )
    const sameTextDifferentTitle = buildSubtitlesSummaryContextHash(
      {
        subtitlesTextContent: "same transcript",
      },
      baseProviderRef,
    )
    const differentText = buildSubtitlesSummaryContextHash(
      {
        subtitlesTextContent: "different transcript",
      },
      baseProviderRef,
    )
    const differentProvider = buildSubtitlesSummaryContextHash(
      {
        subtitlesTextContent: "same transcript",
      },
      { kind: "local", config: { ...baseProviderRef.config, id: "other-provider" } } as never,
    )

    expect(first).toBe(sameTextDifferentTitle)
    expect(first).not.toBe(differentText)
    expect(first).not.toBe(differentProvider)
  })

  it("builds subtitle summary context hashes from cleaned text capped by cleanText's default limit", async () => {
    const { buildSubtitlesSummaryContextHash } = await import("../translator")

    const baseProviderRef: SerializableProviderRef = {
      kind: "local",
      config: {
        id: "openai-default",
        name: "OpenAI",
        provider: "openai",
        enabled: true,
        apiKey: "sk-test",
        model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
      } as never,
    }

    const prefix = "a".repeat(3000)
    const first = buildSubtitlesSummaryContextHash(
      {
        subtitlesTextContent: `${prefix}tail-a`,
      },
      baseProviderRef,
    )
    const second = buildSubtitlesSummaryContextHash(
      {
        subtitlesTextContent: `${prefix}tail-b`,
      },
      baseProviderRef,
    )
    const differentWithinLimit = buildSubtitlesSummaryContextHash(
      {
        subtitlesTextContent: `${"b".repeat(3000)}tail-a`,
      },
      baseProviderRef,
    )

    expect(first).toBe(second)
    expect(first).not.toBe(differentWithinLimit)
  })
})
