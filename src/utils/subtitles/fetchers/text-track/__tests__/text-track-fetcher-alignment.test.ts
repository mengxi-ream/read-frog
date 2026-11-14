import { afterEach, describe, expect, it, vi } from "vitest"
import { TEXT_TRACK_CUE_POLL_INTERVAL_MS } from "@/utils/constants/subtitles"
import { TextTrackFetcher } from ".."

const BROADCAST_CUE = { startTime: 3601.583, endTime: 3603.083, text: "Welcome to Max Power." }
const ALIGNED = [{ text: "Welcome to Max Power.", start: 1583, end: 3083 }]

function videoPlaying(durationSec: number) {
  const track = {
    kind: "subtitles",
    label: "English",
    language: "en",
    mode: "hidden",
    cues: [BROADCAST_CUE],
  }
  return { duration: durationSec, textTracks: [track] } as unknown as HTMLVideoElement
}

function fetcherFor(video: HTMLVideoElement) {
  return new TextTrackFetcher({ resolveVideo: () => video, getVideoId: () => "1" })
}

describe("TextTrackFetcher alignment", () => {
  afterEach(() => vi.useRealTimers())

  it("lines up captions counted from 01:00:00 with the video they play over", async () => {
    await expect(fetcherFor(videoPlaying(87)).fetch()).resolves.toEqual(ALIGNED)
  })

  it("waits for the video's length when the cues arrive before its metadata", async () => {
    vi.useFakeTimers()
    const video = videoPlaying(Number.NaN)
    const pending = fetcherFor(video).fetch()

    await vi.advanceTimersByTimeAsync(TEXT_TRACK_CUE_POLL_INTERVAL_MS)
    Object.assign(video, { duration: 87 })
    await vi.advanceTimersByTimeAsync(TEXT_TRACK_CUE_POLL_INTERVAL_MS)

    await expect(pending).resolves.toEqual(ALIGNED)
  })
})
