// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { promptForSubtitlesRefusal, resetPromptedSubtitlesVideos } from "../built-in-ai-refusal"

const { mockPromptForBuiltInAiRefusal, mockToastAdd } = vi.hoisted(() => ({
  mockPromptForBuiltInAiRefusal: vi.fn<(...args: any[]) => Promise<boolean>>(),
  mockToastAdd: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/content-runtime/built-in-ai-prompt", () => ({
  promptForBuiltInAiRefusal: mockPromptForBuiltInAiRefusal,
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: mockToastAdd },
}))

/** A cue batch the server refused, relayed from the background. */
function spentPoolError() {
  return new Error("Built-in AI quota used up", {
    cause: Object.assign(new Error("x"), { code: "HOSTED_AI_QUOTA_EXHAUSTED" }),
  })
}

function options(videoKey: string) {
  return { videoKey, trigger: "user" as const, retry: vi.fn<() => void>() }
}

describe("promptForSubtitlesRefusal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPromptForBuiltInAiRefusal.mockResolvedValue(true)
    resetPromptedSubtitlesVideos()
  })

  it("asks once a video, however many cue batches are refused", () => {
    const first = options("video-A")

    expect(promptForSubtitlesRefusal(spentPoolError(), first)).toBe(true)
    expect(promptForSubtitlesRefusal(spentPoolError(), options("video-A"))).toBe(true)
    expect(promptForSubtitlesRefusal(spentPoolError(), options("video-A"))).toBe(true)

    expect(mockPromptForBuiltInAiRefusal).toHaveBeenCalledOnce()
    expect(mockPromptForBuiltInAiRefusal).toHaveBeenCalledWith(expect.any(Error), {
      feature: "videoSubtitles",
      analyticsFeature: "video_subtitles",
      trigger: "user",
      retry: first.retry,
      beforePrompt: expect.any(Function),
    })
  })

  it("gives Ultra, which the prompt passes over, its plain message once a video", async () => {
    mockPromptForBuiltInAiRefusal.mockResolvedValue(false)

    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))
    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))

    await vi.waitFor(() => expect(mockToastAdd).toHaveBeenCalledOnce())
    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "Built-in AI quota used up" }),
    )
  })

  it("adds no toast of its own when the prompt showed one", async () => {
    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))

    await vi.waitFor(() => expect(mockPromptForBuiltInAiRefusal).toHaveBeenCalledOnce())
    await Promise.resolve()
    expect(mockToastAdd).not.toHaveBeenCalled()
  })

  it("asks a guest who logs in on the same video to upgrade once the pool is spent", () => {
    const guestRefusal = new Error("Log in to use Built-in AI", {
      cause: Object.assign(new Error("x"), { code: "UNAUTHORIZED" }),
    })

    promptForSubtitlesRefusal(guestRefusal, options("video-A"))
    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))
    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))

    expect(mockPromptForBuiltInAiRefusal).toHaveBeenCalledTimes(2)
    expect(mockPromptForBuiltInAiRefusal.mock.calls.map(([error]) => error.message)).toEqual([
      "Log in to use Built-in AI",
      "Built-in AI quota used up",
    ])
  })

  it("asks again for the next video", () => {
    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))
    promptForSubtitlesRefusal(spentPoolError(), { ...options("video-B"), trigger: "auto" })

    expect(mockPromptForBuiltInAiRefusal).toHaveBeenCalledTimes(2)
    expect(mockPromptForBuiltInAiRefusal.mock.calls[1]![1]).toMatchObject({ trigger: "auto" })
  })

  it("leaves any other failure to the subtitles' own error", () => {
    expect(promptForSubtitlesRefusal(new Error("Failed to fetch"), options("video-A"))).toBe(false)
    expect(mockPromptForBuiltInAiRefusal).not.toHaveBeenCalled()

    // A failure that wasn't a refusal doesn't use up the video's prompt.
    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))
    expect(mockPromptForBuiltInAiRefusal).toHaveBeenCalledOnce()
  })

  it("leaves fullscreen before the prompt shows, which a fullscreen player would cover", async () => {
    const exitFullscreen = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen })
    // jsdom has no Fullscreen API.
    let fullscreenElement: Element | null = document.body
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    })

    promptForSubtitlesRefusal(spentPoolError(), options("video-A"))
    await mockPromptForBuiltInAiRefusal.mock.calls[0]![1].beforePrompt()
    expect(exitFullscreen).toHaveBeenCalledOnce()

    fullscreenElement = null
    await mockPromptForBuiltInAiRefusal.mock.calls[0]![1].beforePrompt()
    expect(exitFullscreen).toHaveBeenCalledOnce()
  })
})
