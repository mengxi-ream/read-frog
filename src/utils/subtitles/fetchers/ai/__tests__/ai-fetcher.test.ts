import type { AiSubtitlesContext } from "../../../ai/request-ai-subtitles"
import { beforeEach, describe, expect, it, vi } from "vitest"

const requestAiSubtitles =
  vi.fn<(ctx: AiSubtitlesContext, opts?: { signal?: AbortSignal }) => Promise<unknown>>()

vi.mock("@/utils/subtitles/ai/request-ai-subtitles", () => ({
  requestAiSubtitles: (ctx: AiSubtitlesContext, opts?: { signal?: AbortSignal }) =>
    requestAiSubtitles(ctx, opts),
}))

const { AiSubtitlesFetcher } = await import("../index")

function contextFor(videoId: string): AiSubtitlesContext {
  return { videoId, url: `https://youtube.com/watch?v=${videoId}` }
}

describe("aiSubtitlesFetcher", () => {
  beforeEach(() => {
    requestAiSubtitles.mockReset()
  })

  it("throws when no context is available", async () => {
    const fetcher = new AiSubtitlesFetcher(() => null)
    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.noSubtitlesFound")
    expect(requestAiSubtitles).not.toHaveBeenCalled()
  })

  it("caches by videoId and does not request twice", async () => {
    requestAiSubtitles.mockResolvedValue({
      segments: [{ text: "hi", start: 0, end: 100 }],
      detectedLanguage: "en",
    })
    const fetcher = new AiSubtitlesFetcher(() => contextFor("abc"))

    const first = await fetcher.fetch()
    const second = await fetcher.fetch()

    expect(first).toEqual([{ text: "hi", start: 0, end: 100 }])
    expect(second).toBe(first)
    expect(requestAiSubtitles).toHaveBeenCalledTimes(1)
    expect(fetcher.getSourceLanguage()).toBe("en")
    expect(fetcher.isPreSegmented()).toBe(true)
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)
  })

  it("shares the in-flight request between concurrent callers for the same video", async () => {
    let resolveRequest: (value: unknown) => void = () => {}
    requestAiSubtitles.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        }),
    )
    const fetcher = new AiSubtitlesFetcher(() => contextFor("abc"))

    const first = fetcher.fetch()
    const second = fetcher.fetch()
    resolveRequest({ segments: [{ text: "hi", start: 0, end: 100 }], detectedLanguage: "en" })
    const [r1, r2] = await Promise.all([first, second])

    expect(requestAiSubtitles).toHaveBeenCalledTimes(1)
    expect(r1).toEqual([{ text: "hi", start: 0, end: 100 }])
    expect(r2).toBe(r1)
  })

  it("re-fetches when the videoId changes", async () => {
    let videoId = "abc"
    requestAiSubtitles.mockImplementation(async () => ({
      segments: [{ text: videoId, start: 0, end: 100 }],
      detectedLanguage: "en",
    }))
    const fetcher = new AiSubtitlesFetcher(() => contextFor(videoId))

    await fetcher.fetch()
    videoId = "def"
    const result = await fetcher.fetch()

    expect(requestAiSubtitles).toHaveBeenCalledTimes(2)
    expect(result).toEqual([{ text: "def", start: 0, end: 100 }])
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)
  })

  it("discards a stale result when the videoId changed during the request", async () => {
    let videoId = "abc"
    requestAiSubtitles.mockImplementation(async () => {
      videoId = "def"
      return { segments: [{ text: "stale", start: 0, end: 100 }], detectedLanguage: "en" }
    })
    const fetcher = new AiSubtitlesFetcher(() => contextFor(videoId))

    await expect(fetcher.fetch()).rejects.toThrow("Aborted")
  })

  it("aborts the in-flight request on cleanup", async () => {
    let capturedSignal: AbortSignal | undefined
    requestAiSubtitles.mockImplementation(
      (_ctx: AiSubtitlesContext, opts?: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal
        return new Promise(() => {})
      },
    )
    const fetcher = new AiSubtitlesFetcher(() => contextFor("abc"))

    void fetcher.fetch()
    await Promise.resolve()

    expect(capturedSignal?.aborted).toBe(false)
    fetcher.cleanup()
    expect(capturedSignal?.aborted).toBe(true)
  })

  it("reflects context availability", async () => {
    const withCtx = new AiSubtitlesFetcher(() => contextFor("abc"))
    const withoutCtx = new AiSubtitlesFetcher(() => null)

    await expect(withCtx.hasAvailableSubtitles()).resolves.toBe(true)
    await expect(withoutCtx.hasAvailableSubtitles()).resolves.toBe(false)
    await expect(withCtx.shouldUseSameTrack()).resolves.toBe(false)
  })
})
