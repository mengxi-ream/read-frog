import { ORPCError } from "@orpc/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const create = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const get = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const getSubtitles = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock("@/env", () => ({
  env: { WXT_WEBSITE_URL: "https://readfrog.app" },
}))

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

const ctx = { videoId: "abc", url: "https://youtube.com/watch?v=abc", durationSec: 600 }

/** Resolves with the rejection value so its shape (action included) can be asserted. */
function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

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
      durationSec: 600,
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

  // The deadline bounds the wait, not the job: the server keeps transcribing and
  // caches the result, so expiry is a "still working" toast, never a failure
  // overlay. For a 600s video the deadline is 8min + 60s = 9 minutes.
  it("reports still-processing (not failure) when the deadline expires", async () => {
    vi.useFakeTimers()
    create.mockResolvedValue({ id: "job-4", status: "pending", detectedLanguage: null })
    get.mockResolvedValue({ id: "job-4", status: "processing", detectedLanguage: null })

    const captured = requestAiSubtitles(ctx).then(
      () => null,
      (settledError: unknown) => settledError,
    )
    await vi.advanceTimersByTimeAsync(8 * 60 * 1_000)
    expect(await Promise.race([captured, Promise.resolve("waiting")])).toBe("waiting")

    await vi.advanceTimersByTimeAsync(2 * 60 * 1_000)

    expect(await captured).toMatchObject({
      name: "ToastSubtitlesError",
      message: "subtitles.errors.aiStillProcessing",
    })
    expect(getSubtitles).not.toHaveBeenCalled()
  })

  it("throws immediately when the signal is already aborted", async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(requestAiSubtitles(ctx, { signal: controller.signal })).rejects.toThrow("Aborted")
    expect(create).not.toHaveBeenCalled()
  })

  it("converts a quota error into a toast offering the upgrade", async () => {
    create.mockRejectedValue(new ORPCError("VIDEO_TRANSCRIPTION_QUOTA_EXCEEDED", { defined: true }))

    await expect(rejection(requestAiSubtitles(ctx))).resolves.toMatchObject({
      name: "ToastSubtitlesError",
      message: "subtitles.errors.aiQuotaExceeded",
      action: { label: "action.upgrade", url: "https://readfrog.app/pricing" },
    })
    expect(get).not.toHaveBeenCalled()
  })

  // Nothing navigates on its own: the error only describes the button, and the
  // player's toast host is what opens the tab once the user presses it.
  it("offers pricing as an action when a subscription is required", async () => {
    create.mockRejectedValue(
      new ORPCError("VIDEO_TRANSCRIPTION_SUBSCRIPTION_REQUIRED", { defined: true }),
    )

    await expect(rejection(requestAiSubtitles(ctx))).resolves.toMatchObject({
      name: "ToastSubtitlesError",
      message: "subtitles.errors.aiSubscriptionRequired",
      action: { url: "https://readfrog.app/pricing" },
    })
    expect(get).not.toHaveBeenCalled()
  })

  it("points a dunning account at billing, not at pricing", async () => {
    // They already subscribe; the card just failed. Pricing would invite them
    // to subscribe a second time.
    create.mockRejectedValue(
      new ORPCError("VIDEO_TRANSCRIPTION_PAYMENT_REQUIRED", { defined: true }),
    )

    await expect(rejection(requestAiSubtitles(ctx))).resolves.toMatchObject({
      name: "ToastSubtitlesError",
      message: "subtitles.errors.aiPaymentRequired",
      // "Upgrade" would say the wrong thing to someone who already subscribes.
      action: { label: "action.updatePayment", url: "https://readfrog.app/home" },
    })
    expect(get).not.toHaveBeenCalled()
  })

  it("offers no upsell when the video itself is too long", async () => {
    create.mockRejectedValue(
      new ORPCError("VIDEO_TRANSCRIPTION_UNSUPPORTED_LENGTH", { defined: true }),
    )

    const error = await rejection(requestAiSubtitles(ctx))
    expect(error).toMatchObject({
      name: "ToastSubtitlesError",
      message: "subtitles.errors.aiVideoTooLong",
    })
    // No plan and no reset makes this video work, so neither is suggested.
    expect((error as { action?: unknown }).action).toBeUndefined()
    expect(get).not.toHaveBeenCalled()
  })

  it("shows a localized generic error for other create failures", async () => {
    create.mockRejectedValue(new ORPCError("VIDEO_TRANSCRIPT_NOT_FOUND", { defined: true }))
    await expect(requestAiSubtitles(ctx)).rejects.toThrow("subtitles.errors.aiRequestFailed")
    expect(get).not.toHaveBeenCalled()
  })

  // `get` and `getSubtitles` sit behind the same entitlement middleware as
  // `create`, so a subscription that lapses mid-poll surfaces here.
  it("offers the upgrade when the plan wall arrives while polling", async () => {
    create.mockResolvedValue({ id: "job-5", status: "pending", detectedLanguage: null })
    get.mockRejectedValue(
      new ORPCError("VIDEO_TRANSCRIPTION_SUBSCRIPTION_REQUIRED", { defined: true }),
    )

    await expect(rejection(requestAiSubtitles(ctx))).resolves.toMatchObject({
      name: "ToastSubtitlesError",
      message: "subtitles.errors.aiSubscriptionRequired",
      action: { url: "https://readfrog.app/pricing" },
    })
    expect(getSubtitles).not.toHaveBeenCalled()
  })

  it("reports a not-ready transcript as still processing rather than a failure", async () => {
    create.mockResolvedValue({ id: "job-6", status: "completed", detectedLanguage: "en" })
    getSubtitles.mockRejectedValue(new ORPCError("VIDEO_TRANSCRIPT_NOT_READY", { defined: true }))

    await expect(rejection(requestAiSubtitles(ctx))).resolves.toMatchObject({
      name: "ToastSubtitlesError",
      message: "subtitles.errors.aiStillProcessing",
    })
  })

  // Raw ORPCError messages are the server's untranslated English; they must
  // never reach the player overlay.
  it("localizes a missing transcript instead of leaking the server message", async () => {
    create.mockResolvedValue({ id: "job-7", status: "completed", detectedLanguage: "en" })
    getSubtitles.mockRejectedValue(new ORPCError("VIDEO_TRANSCRIPT_NOT_FOUND", { defined: true }))

    await expect(rejection(requestAiSubtitles(ctx))).resolves.toMatchObject({
      name: "OverlaySubtitlesError",
      message: "subtitles.errors.aiRequestFailed",
    })
  })
})
