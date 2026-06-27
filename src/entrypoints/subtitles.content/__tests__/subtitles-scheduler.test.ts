import { afterEach, describe, expect, it, vi } from "vitest"
import { currentSubtitleAtom, subtitlesStateAtom, subtitlesStore } from "../atoms"
import { SubtitlesScheduler } from "../subtitles-scheduler"

describe("subtitles scheduler", () => {
  afterEach(() => {
    vi.useRealTimers()
    subtitlesStore.set(currentSubtitleAtom, null)
    subtitlesStore.set(subtitlesStateAtom, null)
  })

  it("auto-hides error state after a delay", () => {
    vi.useFakeTimers()

    const videoElement = {
      currentTime: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLVideoElement

    const scheduler = new SubtitlesScheduler({ videoElement })
    scheduler.setState("error", { message: "boom" })

    expect(subtitlesStore.get(subtitlesStateAtom)?.state).toBe("error")

    vi.advanceTimersByTime(5_000)
    expect(subtitlesStore.get(subtitlesStateAtom)).toBeNull()
  })

  it("updates live subtitle timing and switches away from a shortened cue", () => {
    const videoElement = {
      currentTime: 12,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as HTMLVideoElement

    const scheduler = new SubtitlesScheduler({ videoElement })
    scheduler.start()
    scheduler.supplementSubtitles([
      { text: "First", translation: "第一句", start: 10_000, end: 16_000 },
    ])

    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("First")

    scheduler.supplementSubtitles([
      { text: "First", start: 10_000, end: 11_700 },
      { text: "Second", translation: "第二句", start: 11_700, end: 18_000 },
    ])

    expect(subtitlesStore.get(currentSubtitleAtom)).toMatchObject({
      text: "Second",
      translation: "第二句",
    })
  })
})
