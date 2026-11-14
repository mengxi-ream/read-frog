import { describe, expect, it } from "vitest"
import { alignToVideo, cuesToFragments } from "../cues"

function cue(startTime: number, endTime: number, text: string): TextTrackCue {
  return { startTime, endTime, text } as unknown as TextTrackCue
}

const HOUR_MS = 60 * 60 * 1000

function fragmentAt(start: number, end: number, text = "line") {
  return { text, start, end }
}

describe("cuesToFragments", () => {
  it("strips cue tags and decodes entities", () => {
    expect(cuesToFragments([cue(0, 1, "<c.yellow>Tom &amp; Jerry</c>")])[0]?.text).toBe(
      "Tom & Jerry",
    )
  })

  it("trims lines and drops empty ones", () => {
    expect(cuesToFragments([cue(0, 1, "  first  \n\n  second  ")])[0]?.text).toBe("first\nsecond")
  })

  it("converts seconds to rounded milliseconds", () => {
    expect(cuesToFragments([cue(1.2345, 2.5, "hi")])).toEqual([
      { text: "hi", start: 1235, end: 2500 },
    ])
  })

  it("drops cues with empty text or a non-positive duration", () => {
    const fragments = cuesToFragments([
      cue(0, 1, "<c></c>"),
      cue(2, 2, "zero"),
      cue(4, 3, "reversed"),
      cue(5, 6, "kept"),
    ])

    expect(fragments).toEqual([{ text: "kept", start: 5000, end: 6000 }])
  })

  it("sorts by start then end time", () => {
    const fragments = cuesToFragments([cue(3, 4, "c"), cue(1, 3, "b"), cue(1, 2, "a")])

    expect(fragments.map((fragment) => fragment.text)).toEqual(["a", "b", "c"])
  })
})

describe("alignToVideo", () => {
  it("moves captions counted from 01:00:00 back onto a shorter video", () => {
    const fragments = [
      fragmentAt(HOUR_MS + 1583, HOUR_MS + 3083),
      fragmentAt(HOUR_MS + 13833, HOUR_MS + 16000),
    ]

    expect(alignToVideo(fragments, 87)).toEqual([fragmentAt(1583, 3083), fragmentAt(13833, 16000)])
  })

  it("moves them back on a video longer than an hour too", () => {
    const fragments = [
      fragmentAt(HOUR_MS + 1000, HOUR_MS + 2000),
      fragmentAt(HOUR_MS + 5_380_000, HOUR_MS + 5_390_000),
    ]

    expect(alignToVideo(fragments, 5400)).toEqual([
      fragmentAt(1000, 2000),
      fragmentAt(5_380_000, 5_390_000),
    ])
  })

  it("leaves captions that fit the video, or run a moment past its end", () => {
    const fitting = [fragmentAt(1000, 3000)]
    const overrunning = [fragmentAt(9000, 10_500)]

    expect(alignToVideo(fitting, 87)).toBe(fitting)
    expect(alignToVideo(overrunning, 10)).toBe(overrunning)
  })

  it("leaves captions alone while the video's length is unknown", () => {
    const fragments = [fragmentAt(HOUR_MS + 1583, HOUR_MS + 3083)]

    expect(alignToVideo(fragments, Number.NaN)).toBe(fragments)
    expect(alignToVideo(fragments, Number.POSITIVE_INFINITY)).toBe(fragments)
  })
})
