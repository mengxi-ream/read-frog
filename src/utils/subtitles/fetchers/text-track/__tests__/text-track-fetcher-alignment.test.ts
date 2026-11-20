import { afterEach, describe, expect, it, vi } from "vitest"
import {
  TEXT_TRACK_CUE_POLL_INTERVAL_MS,
  TEXT_TRACK_CUE_WAIT_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
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

function fetcherFor(video: HTMLVideoElement, isBroadcastTimed = () => true) {
  return new TextTrackFetcher({
    resolveVideo: () => video,
    getVideoId: () => "1",
    isBroadcastTimed,
  })
}

describe("TextTrackFetcher alignment", () => {
  afterEach(() => vi.useRealTimers())

  it("lines up captions counted from 01:00:00 with the video they play over", async () => {
    await expect(fetcherFor(videoPlaying(87)).fetch()).resolves.toEqual(ALIGNED)
  })

  it.each([
    ["before its metadata", Number.NaN],
    ["while a streamed source has not set it", Number.POSITIVE_INFINITY],
  ])("waits for the video's length when the cues arrive %s", async (_when, unknownDuration) => {
    vi.useFakeTimers()
    const video = videoPlaying(unknownDuration)
    const pending = fetcherFor(video).fetch()

    await vi.advanceTimersByTimeAsync(TEXT_TRACK_CUE_POLL_INTERVAL_MS)
    Object.assign(video, { duration: 87 })
    await vi.advanceTimersByTimeAsync(TEXT_TRACK_CUE_POLL_INTERVAL_MS)

    await expect(pending).resolves.toEqual(ALIGNED)
  })

  it("keeps the times of a live video, which never gets a length", async () => {
    vi.useFakeTimers()
    const pending = fetcherFor(videoPlaying(Number.POSITIVE_INFINITY)).fetch()

    await vi.advanceTimersByTimeAsync(TEXT_TRACK_CUE_WAIT_TIMEOUT_MS)

    await expect(pending).resolves.toEqual([
      { text: "Welcome to Max Power.", start: 3_601_583, end: 3_603_083 },
    ])
  })

  it("keeps the times of a track the platform does not mark as broadcast-timed", async () => {
    await expect(fetcherFor(videoPlaying(87), () => false).fetch()).resolves.toEqual([
      { text: "Welcome to Max Power.", start: 3_601_583, end: 3_603_083 },
    ])
  })
})
