import { ORPCError } from "@orpc/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const create = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const get = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const getSubtitles = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock("@/utils/orpc/client", () => ({
  orpcClient: {
    videoTranscript: {
      create: (...args: unknown[]) => create(...args),
      get: (...args: unknown[]) => get(...args),
      getSubtitles: (...args: unknown[]) => getSubtitles(...args),
    },
  },
}))

const { requestAiSubtitles } = await import("../request-ai-subtitles")

const ctx = { videoId: "abc", url: "https://youtube.com/watch?v=abc" }

describe("requestAiSubtitles", () => {
  beforeEach(() => {
    create.mockReset()
    get.mockReset()
    getSubtitles.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("maps segments and detectedLanguage when the job is already completed", async () => {
    create.mockResolvedValue({ id: "job-1", status: "completed", detectedLanguage: "en" })
    getSubtitles.mockResolvedValue({
      id: "job-1",
      detectedLanguage: "en",
      segments: [
        { start: 1, end: 2, text: "hello" },
        { start: 2, end: 4, text: "world" },
      ],
    })

    const result = await requestAiSubtitles(ctx)

    expect(create).toHaveBeenCalledWith({
      url: "https://youtube.com/watch?v=abc",
    })
    expect(get).not.toHaveBeenCalled()
    expect(result).toEqual({
      detectedLanguage: "en",
      segments: [
        { text: "hello", start: 1000, end: 2000 },
        { text: "world", start: 2000, end: 4000 },
      ],
    })
  })

  it("polls get until the job is completed", async () => {
    vi.useFakeTimers()
    create.mockResolvedValue({ id: "job-2", status: "pending", detectedLanguage: null })
    get
      .mockResolvedValueOnce({ id: "job-2", status: "processing", detectedLanguage: null })
      .mockResolvedValueOnce({ id: "job-2", status: "completed", detectedLanguage: "ja" })
    getSubtitles.mockResolvedValue({
      id: "job-2",
      detectedLanguage: "ja",
      segments: [{ start: 0, end: 5, text: "こんにちは" }],
    })

    const promise = requestAiSubtitles(ctx)
    await vi.advanceTimersByTimeAsync(10_000)
    const result = await promise

    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenCalledWith({ id: "job-2" })
    expect(result).toEqual({
      detectedLanguage: "ja",
      segments: [{ text: "こんにちは", start: 0, end: 5000 }],
    })
  })

  it("throws when the job fails", async () => {
    create.mockResolvedValue({ id: "job-3", status: "failed", detectedLanguage: null })

    await expect(requestAiSubtitles(ctx)).rejects.toThrow("subtitles.errors.aiServiceUnavailable")
    expect(getSubtitles).not.toHaveBeenCalled()
  })

  it("throws a timeout error when the job never completes", async () => {
    vi.useFakeTimers()
    create.mockResolvedValue({ id: "job-4", status: "pending", detectedLanguage: null })
    get.mockResolvedValue({ id: "job-4", status: "processing", detectedLanguage: null })

    const captured = requestAiSubtitles(ctx).then(
      () => null,
      (settledError: unknown) => settledError,
    )
    await vi.advanceTimersByTimeAsync(6 * 60 * 1_000)

    expect(await captured).toMatchObject({ message: "subtitles.errors.fetchSubTimeout" })
    expect(getSubtitles).not.toHaveBeenCalled()
  })

  it("throws immediately when the signal is already aborted", async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(requestAiSubtitles(ctx, { signal: controller.signal })).rejects.toThrow("Aborted")
    expect(create).not.toHaveBeenCalled()
  })

  it("converts a quota error into a localized toast error", async () => {
    const error = new ORPCError("VIDEO_TRANSCRIPTION_QUOTA_EXCEEDED", { defined: true })
    create.mockRejectedValue(error)

    await expect(requestAiSubtitles(ctx)).rejects.toThrow("subtitles.errors.aiQuotaExceeded")
    expect(get).not.toHaveBeenCalled()
  })

  it("shows a localized generic error for other create failures (login/beta are pre-checked)", async () => {
    create.mockRejectedValue(new ORPCError("VIDEO_TRANSCRIPT_NOT_FOUND", { defined: true }))
    await expect(requestAiSubtitles(ctx)).rejects.toThrow("subtitles.errors.aiRequestFailed")
    expect(get).not.toHaveBeenCalled()
  })
})
