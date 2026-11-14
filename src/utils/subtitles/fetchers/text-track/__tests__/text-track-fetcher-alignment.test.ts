import { describe, expect, it } from "vitest"
import { TextTrackFetcher } from ".."

function videoPlaying(
  durationSec: number,
  cues: Array<Pick<VTTCue, "startTime" | "endTime" | "text">>,
) {
  const track = { kind: "subtitles", label: "English", language: "en", mode: "hidden", cues }
  return { duration: durationSec, textTracks: [track] } as unknown as HTMLVideoElement
}

describe("TextTrackFetcher alignment", () => {
  it("lines up captions counted from 01:00:00 with the video they play over", async () => {
    const video = videoPlaying(87, [
      { startTime: 3601.583, endTime: 3603.083, text: "Welcome to Max Power." },
    ])
    const fetcher = new TextTrackFetcher({ resolveVideo: () => video, getVideoId: () => "1" })

    await expect(fetcher.fetch()).resolves.toEqual([
      { text: "Welcome to Max Power.", start: 1583, end: 3083 },
    ])
  })
})
