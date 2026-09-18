import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  TEXT_TRACK_CUE_POLL_INTERVAL_MS,
  TEXT_TRACK_NATIVE_REHIDE_DELAY_MS,
} from "@/utils/constants/subtitles"
import { TextTrackFetcher } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

class FakeTrack extends EventTarget {
  cues: ArrayLike<TextTrackCue> | null = null

  constructor(
    public kind: string,
    public label: string,
    public language: string,
    public mode: string,
  ) {
    super()
  }

  loadCues(...texts: string[]) {
    this.cues = texts.map((text, index) => ({
      startTime: index,
      endTime: index + 1,
      text,
    })) as unknown as TextTrackCue[]
  }
}

function videoWith(...tracks: FakeTrack[]): HTMLVideoElement {
  return { textTracks: tracks } as unknown as HTMLVideoElement
}

function createFetcher(video: HTMLVideoElement | null, videoId = "1") {
  return new TextTrackFetcher({ resolveVideo: () => video, getVideoId: () => videoId })
}

describe("TextTrackFetcher", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("prefers the showing subtitle track and flips disabled tracks to hidden to load cues", async () => {
    const english = new FakeTrack("subtitles", "English", "en", "disabled")
    const japanese = new FakeTrack("subtitles", "日本語", "ja", "showing")
    japanese.loadCues("こんにちは")
    const fetcher = createFetcher(videoWith(english, japanese))

    await expect(fetcher.fetch()).resolves.toEqual([{ text: "こんにちは", start: 0, end: 1000 }])
    expect(fetcher.getSourceLanguage()).toBe("ja")
    expect(english.mode).toBe("disabled")

    japanese.mode = "disabled"
    english.loadCues("hello")
    await createFetcher(videoWith(english, japanese)).hasAvailableSubtitles()
    expect(english.mode).toBe("hidden")
  })

  it("waits for cues that load after the request", async () => {
    const track = new FakeTrack("subtitles", "English", "en", "hidden")
    const pending = createFetcher(videoWith(track)).fetch()

    track.loadCues("late")
    await vi.advanceTimersByTimeAsync(TEXT_TRACK_CUE_POLL_INTERVAL_MS)

    await expect(pending).resolves.toEqual([{ text: "late", start: 0, end: 1000 }])
  })

  it("reuses the same track until the video changes", async () => {
    const track = new FakeTrack("subtitles", "English", "en", "showing")
    track.loadCues("hello")
    let videoId = "1"
    const fetcher = new TextTrackFetcher({
      resolveVideo: () => videoWith(track),
      getVideoId: () => videoId,
    })

    await fetcher.fetch()
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(true)

    videoId = "2"
    await expect(fetcher.shouldUseSameTrack()).resolves.toBe(false)
  })

  it("hides showing tracks, re-applies after the player flips them back, and restores on show", () => {
    const track = new FakeTrack("subtitles", "English", "en", "showing")
    const fetcher = createFetcher(videoWith(track))

    fetcher.hideNativeSubtitles()
    expect(track.mode).toBe("hidden")

    track.mode = "showing"
    vi.advanceTimersByTime(TEXT_TRACK_NATIVE_REHIDE_DELAY_MS)
    expect(track.mode).toBe("hidden")

    fetcher.showNativeSubtitles()
    expect(track.mode).toBe("showing")
  })

  it("rejects when the video has no subtitle tracks", async () => {
    const fetcher = createFetcher(videoWith(new FakeTrack("metadata", "", "", "hidden")))

    await expect(fetcher.hasAvailableSubtitles()).resolves.toBe(false)
    await expect(fetcher.fetch()).rejects.toThrow("subtitles.errors.noSubtitlesFound")
  })
})
