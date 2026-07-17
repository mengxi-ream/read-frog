import { afterEach, describe, expect, it, vi } from "vitest"
import { currentSubtitleAtom, subtitlesStateAtom, subtitlesStore } from "../atoms"
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
  })

  it("auto-hides error state after a delay", () => {
    vi.useFakeTimers()

    const scheduler = new SubtitlesScheduler({ videoElement: createVideo() })
    scheduler.setState("error", { message: "boom" })

    expect(subtitlesStore.get(subtitlesStateAtom)?.state).toBe("error")

    vi.advanceTimersByTime(5_000)
    expect(subtitlesStore.get(subtitlesStateAtom)).toBeNull()
  })

  it("shows original fragments immediately after supplement without translation", () => {
    const video = createVideo(0.25)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([{ text: "hello world", start: 0, end: 1000 }])

    expect(subtitlesStore.get(currentSubtitleAtom)).toEqual({
      text: "hello world",
      start: 0,
      end: 1000,
    })
  })

  it("fills in translation on an existing original cue", () => {
    const video = createVideo(0.25)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([{ text: "hello world", start: 0, end: 1000 }])
    scheduler.supplementSubtitles(
      [{ text: "hello world", start: 0, end: 1000, translation: "你好世界" }],
      { mergeOnly: true },
    )

    expect(subtitlesStore.get(currentSubtitleAtom)).toEqual({
      text: "hello world",
      start: 0,
      end: 1000,
      translation: "你好世界",
    })
  })

  it("applies empty-string translation in mergeOnly mode without re-inserting unknown starts", () => {
    const video = createVideo(0.25)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([{ text: "hello world", start: 0, end: 1000 }])
    scheduler.supplementSubtitles(
      [
        { text: "hello world", start: 0, end: 1000, translation: "" },
        { text: "stale cue", start: 9999, end: 10_000, translation: "幽灵" },
      ],
      { mergeOnly: true },
    )

    expect(subtitlesStore.get(currentSubtitleAtom)).toEqual({
      text: "hello world",
      start: 0,
      end: 1000,
      translation: "",
    })

    video.currentTime = 10
    ;(scheduler as any).updateSubtitles(10)
    expect(subtitlesStore.get(currentSubtitleAtom)).toBeNull()
  })

  it("replaceTimeWindow removes cues in the window and inserts next fragments", () => {
    // Start outside any cue so nothing is sticky-protected during replace.
    const video = createVideo(10)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([
      { text: "a", start: 0, end: 500 },
      { text: "b", start: 500, end: 1000 },
      { text: "c", start: 2000, end: 2500 },
    ])

    scheduler.replaceTimeWindow(0, 1000, [{ text: "ab", start: 0, end: 1000 }])

    // Seek into the replaced window
    video.currentTime = 0.25
    ;(scheduler as any).updateSubtitles(0.25)

    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("ab")

    // Cue outside the window remains
    video.currentTime = 2.1
    ;(scheduler as any).updateSubtitles(2.1)
    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("c")
  })

  it("keeps the active cue sticky when re-segmentation overlaps the current time", () => {
    const video = createVideo(0.5)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([{ text: "hello world foo", start: 0, end: 2000 }])
    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("hello world foo")

    scheduler.replaceTimeWindow(0, 2000, [
      { text: "hello world", start: 0, end: 1000 },
      { text: "foo", start: 1000, end: 2000 },
      { text: "after", start: 2000, end: 3000 },
    ])

    // Still inside the protected baseline cue — must not jump mid-line.
    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("hello world foo")

    video.currentTime = 1.5
    ;(scheduler as any).updateSubtitles(1.5)
    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("hello world foo")

    // After the protected cue ends, use the next available cue.
    video.currentTime = 2.1
    ;(scheduler as any).updateSubtitles(2.1)
    expect(subtitlesStore.get(currentSubtitleAtom)?.text).toBe("after")
  })

  it("does not merge a recut same-start translation onto a protected longer cue", () => {
    const video = createVideo(0.5)
    const scheduler = new SubtitlesScheduler({ videoElement: video })
    scheduler.start()

    scheduler.supplementSubtitles([{ text: "hello world foo", start: 0, end: 2000 }])
    scheduler.replaceTimeWindow(0, 2000, [
      { text: "hello world", start: 0, end: 1000 },
      { text: "foo", start: 1000, end: 2000 },
    ])

    // Translation for the recut shorter cue (same start, different end/text).
    scheduler.supplementSubtitles(
      [{ text: "hello world", start: 0, end: 1000, translation: "你好世界" }],
      { mergeOnly: true },
    )

    // Protected baseline must not pick up the recut line's translation.
    expect(subtitlesStore.get(currentSubtitleAtom)).toEqual({
      text: "hello world foo",
      start: 0,
      end: 2000,
    })
  })
})
