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
  return { videoId, url: `https://youtube.com/watch?v=${videoId}`, durationSec: 600 }
}

describe("aiSubtitlesFetcher", () => {
  beforeEach(() => {
    requestAiSubtitles.mockReset()
  })

  it("throws when no context is available", async () => {
    const fetcher = new AiSubtitlesFetcher(async () => null)
    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.noSubtitlesFound")
    expect(requestAiSubtitles).not.toHaveBeenCalled()
  })

  it("caches by videoId and does not request twice", async () => {
    requestAiSubtitles.mockResolvedValue({
      segments: [{ text: "hi", start: 0, end: 100 }],
      detectedLanguage: "en",
    })
    const fetcher = new AiSubtitlesFetcher(async () => contextFor("abc"))

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
    const fetcher = new AiSubtitlesFetcher(async () => contextFor("abc"))

    const first = fetcher.fetch()
    const second = fetcher.fetch()
    await vi.waitFor(() => expect(requestAiSubtitles).toHaveBeenCalled())
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
    const fetcher = new AiSubtitlesFetcher(async () => contextFor(videoId))

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
    const fetcher = new AiSubtitlesFetcher(async () => contextFor(videoId))

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
    const fetcher = new AiSubtitlesFetcher(async () => contextFor("abc"))

    void fetcher.fetch()
    await Promise.resolve()

    expect(capturedSignal?.aborted).toBe(false)
    fetcher.cleanup()
    expect(capturedSignal?.aborted).toBe(true)
  })

  it("starts no request when cleaned up while its context resolves", async () => {
    let resolveContext: (ctx: AiSubtitlesContext) => void = () => {}
    const fetcher = new AiSubtitlesFetcher(
      () =>
        new Promise((resolve) => {
          resolveContext = resolve
        }),
    )

    const fetching = fetcher.fetch()
    fetcher.cleanup()
    resolveContext(contextFor("abc"))

    await expect(fetching).rejects.toMatchObject({ name: "AbortError" })
    expect(requestAiSubtitles).not.toHaveBeenCalled()
  })

  it("keeps a transcript that lands while the context is missing for a moment", async () => {
    let ctx: AiSubtitlesContext | null = contextFor("abc")
    requestAiSubtitles.mockImplementation(async () => {
      ctx = null
      return { segments: [{ text: "hi", start: 0, end: 100 }], detectedLanguage: "en" }
    })
    const fetcher = new AiSubtitlesFetcher(async () => ctx)

    await expect(fetcher.fetch()).resolves.toEqual([{ text: "hi", start: 0, end: 100 }])
  })

  it("keeps a loaded track while the context is missing for a moment, and drops it for another video", async () => {
    requestAiSubtitles.mockResolvedValue({
      segments: [{ text: "hi", start: 0, end: 100 }],
      detectedLanguage: "en",
    })
    let ctx: AiSubtitlesContext | null = contextFor("abc")
    const fetcher = new AiSubtitlesFetcher(async () => ctx)
    await fetcher.fetch()

    ctx = null
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)
    ctx = contextFor("def")
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
  })

  it("reflects context availability", async () => {
    const withCtx = new AiSubtitlesFetcher(async () => contextFor("abc"))
    const withoutCtx = new AiSubtitlesFetcher(async () => null)

    await expect(withCtx.hasAvailableSubtitles()).resolves.toBe(true)
    await expect(withoutCtx.hasAvailableSubtitles()).resolves.toBe(false)
    await expect(withCtx.shouldUseSameTrack()).resolves.toBe(false)
  })
})
