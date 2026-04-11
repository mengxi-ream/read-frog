import type { ProviderConfig } from "@/types/config/provider"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const getLocalConfigMock = vi.fn()
const sendMessageMock = vi.fn()
const getSubtitlesTranslatePromptMock = vi.fn()

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("@/utils/prompts/subtitles", () => ({
  getSubtitlesTranslatePrompt: getSubtitlesTranslatePromptMock,
}))

describe("subtitles translator", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getLocalConfigMock.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: true,
      },
      videoSubtitles: {
        ...DEFAULT_CONFIG.videoSubtitles,
        providerId: "openai-default",
      },
    })

    getSubtitlesTranslatePromptMock.mockResolvedValue({
      systemPrompt: "system",
      prompt: "prompt",
    })
    sendMessageMock.mockResolvedValue("translated subtitle")
  })

  it("includes summary in subtitle requests and uses it in the cache hash", async () => {
    const { translateSubtitles } = await import("../translator")

    const fragments = [{ text: "hello", start: 0, end: 1_000 }]
    const baseContext = {
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
    }

    await translateSubtitles(fragments, { ...baseContext, summary: "Ready summary" })
    await translateSubtitles(fragments, baseContext)

    const firstRequest = sendMessageMock.mock.calls[0][1]
    const secondRequest = sendMessageMock.mock.calls[1][1]

    expect(firstRequest.videoTitle).toBe("Video title")
    expect(firstRequest.subtitlesContext).toBeUndefined()
    expect(firstRequest.summary).toBe("Ready summary")
    expect(secondRequest.videoTitle).toBe("Video title")
    expect(secondRequest.subtitlesContext).toBeUndefined()
    expect(secondRequest.summary).toBeUndefined()
    expect(firstRequest.hash).not.toBe(secondRequest.hash)
  })

  it("keeps summary as a distinct hash input", async () => {
    const { translateSubtitles } = await import("../translator")

    const fragments = [{ text: "hello", start: 0, end: 1_000 }]

    await translateSubtitles(fragments, {
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
      summary: "summary-a",
    })

    await translateSubtitles(fragments, {
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
      summary: "summary-b",
    })

    const firstHash = sendMessageMock.mock.calls[0][1].hash
    const secondHash = sendMessageMock.mock.calls[1][1].hash

    expect(firstHash).not.toBe(secondHash)
  })

  it("requests subtitle summary through a dedicated background message", async () => {
    sendMessageMock.mockResolvedValue("Generated summary")

    const { fetchSubtitlesSummary } = await import("../translator")
    const result = await fetchSubtitlesSummary({
      videoTitle: "Video title",
      subtitlesTextContent: "subtitle transcript",
    })

    expect(result).toBe("Generated summary")
    expect(sendMessageMock).toHaveBeenCalledWith("getSubtitlesSummary", expect.objectContaining({
      videoTitle: "Video title",
      subtitlesContext: "subtitle transcript",
      providerConfig: expect.objectContaining({ id: "openai-default" }),
    }))
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
      translate: {
        ...DEFAULT_CONFIG.translate,
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

    const request = sendMessageMock.mock.calls[0][1]
    expect(request.videoTitle).toBe("Video title")
    expect(request.summary).toBeNull()
  })

  it("builds subtitle summary context hashes from subtitles text and provider config", async () => {
    const { buildSubtitlesSummaryContextHash } = await import("../translator")

    const baseProviderConfig: ProviderConfig = {
      id: "openai-default",
      name: "OpenAI",
      provider: "openai",
      enabled: true,
      apiKey: "sk-test",
      model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
    }

    const first = buildSubtitlesSummaryContextHash({
      subtitlesTextContent: "same transcript",
    }, baseProviderConfig)
    const sameTextDifferentTitle = buildSubtitlesSummaryContextHash({
      subtitlesTextContent: "same transcript",
    }, baseProviderConfig)
    const differentText = buildSubtitlesSummaryContextHash({
      subtitlesTextContent: "different transcript",
    }, baseProviderConfig)
    const differentProvider = buildSubtitlesSummaryContextHash({
      subtitlesTextContent: "same transcript",
    }, { ...baseProviderConfig, id: "other-provider" })

    expect(first).toBe(sameTextDifferentTitle)
    expect(first).not.toBe(differentText)
    expect(first).not.toBe(differentProvider)
  })

  it("builds subtitle summary context hashes from cleaned text capped by cleanText's default limit", async () => {
    const { buildSubtitlesSummaryContextHash } = await import("../translator")

    const baseProviderConfig: ProviderConfig = {
      id: "openai-default",
      name: "OpenAI",
      provider: "openai",
      enabled: true,
      apiKey: "sk-test",
      model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
    }

    const prefix = "a".repeat(3000)
    const first = buildSubtitlesSummaryContextHash({
      subtitlesTextContent: `${prefix}tail-a`,
    }, baseProviderConfig)
    const second = buildSubtitlesSummaryContextHash({
      subtitlesTextContent: `${prefix}tail-b`,
    }, baseProviderConfig)
    const differentWithinLimit = buildSubtitlesSummaryContextHash({
      subtitlesTextContent: `${"b".repeat(3000)}tail-a`,
    }, baseProviderConfig)

    expect(first).toBe(second)
    expect(first).not.toBe(differentWithinLimit)
  })
})
