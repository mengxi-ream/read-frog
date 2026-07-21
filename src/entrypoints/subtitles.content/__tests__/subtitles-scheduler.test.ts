import { afterEach, describe, expect, it, vi } from "vitest"
import {
  currentSubtitleAtom,
  currentTimeMsAtom,
  subtitlesStateAtom,
  subtitlesStore,
} from "../atoms"
import { SubtitlesScheduler } from "../subtitles-scheduler"

function createVideo(currentTime = 0) {
  return {
    currentTime,
    addEventListener: vi.fn<(...args: any[]) => any>(),
    removeEventListener: vi.fn<(...args: any[]) => any>(),
  } as unknown as HTMLVideoElement
}

describe("subtitles scheduler", () => {
  afterEach(() => {
    vi.useRealTimers()
    subtitlesStore.set(currentSubtitleAtom, null)
    subtitlesStore.set(subtitlesStateAtom, null)
    subtitlesStore.set(currentTimeMsAtom, 0)
  })

  it("syncs currentTimeMsAtom on start without waiting for timeupdate", () => {
    subtitlesStore.set(currentTimeMsAtom, 0)
    const scheduler = new SubtitlesScheduler({ videoElement: createVideo(12.5) })
    scheduler.start()
    expect(subtitlesStore.get(currentTimeMsAtom)).toBe(12_500)
  })

  it("auto-hides error state after a delay", () => {
    vi.useFakeTimers()

    const scheduler = new SubtitlesScheduler({ videoElement: createVideo() })
    scheduler.setState("error", { message: "boom" })

    expect(subtitlesStore.get(subtitlesStateAtom)?.state).toBe("error")

    vi.advanceTimersByTime(5_000)
    expect(subtitlesStore.get(subtitlesStateAtom)).toBeNull()
  })

  it("holds only translated cues via supplementSubtitles", () => {
    const video = createVideo(0.25)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([
      { text: "hello world", start: 0, end: 1000, translation: "你好世界" },
    ])

    expect(subtitlesStore.get(currentSubtitleAtom)).toEqual({
      text: "hello world",
      start: 0,
      end: 1000,
      translation: "你好世界",
    })
  })

  it("updates translation on an existing cue", () => {
    const video = createVideo(0.25)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([
      { text: "hello world", start: 0, end: 1000, translation: "你好" },
    ])
    scheduler.supplementSubtitles([
      { text: "hello world", start: 0, end: 1000, translation: "你好世界" },
    ])

    expect(subtitlesStore.get(currentSubtitleAtom)?.translation).toBe("你好世界")
  })

  it("removeCuesInTimeWindow drops translated cues in the window", () => {
    const video = createVideo(0.25)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([
      { text: "a", start: 0, end: 500, translation: "A" },
      { text: "b", start: 500, end: 1000, translation: "B" },
      { text: "c", start: 2000, end: 2500, translation: "C" },
    ])

    scheduler.removeCuesInTimeWindow(0, 1000)

    expect(subtitlesStore.get(currentSubtitleAtom)).toBeNull()

    video.currentTime = 2.1
    ;(scheduler as any).updateSubtitles(2.1)
    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("c")
  })
})
