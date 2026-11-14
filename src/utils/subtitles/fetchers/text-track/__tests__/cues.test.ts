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

  it("takes off only the broadcast hour when a long video's first line comes after an hour", () => {
    const fragments = [
      fragmentAt(2 * HOUR_MS + 600_000, 2 * HOUR_MS + 610_000),
      fragmentAt(2 * HOUR_MS + 3_000_000, 2 * HOUR_MS + 3_010_000),
    ]

    expect(alignToVideo(fragments, 7200)).toEqual([
      fragmentAt(HOUR_MS + 600_000, HOUR_MS + 610_000),
      fragmentAt(HOUR_MS + 3_000_000, HOUR_MS + 3_010_000),
    ])
  })

  it("takes off the broadcast hour when the captions cover only the start of a long video", () => {
    const fragments = [
      fragmentAt(HOUR_MS, HOUR_MS + 10_000),
      fragmentAt(HOUR_MS + 1_790_000, HOUR_MS + 1_800_000),
    ]

    expect(alignToVideo(fragments, 7200)).toEqual([
      fragmentAt(0, 10_000),
      fragmentAt(1_790_000, 1_800_000),
    ])
  })

  it("takes off as many hours as a later broadcast start needs", () => {
    const fragments = [fragmentAt(10 * HOUR_MS + 1000, 10 * HOUR_MS + 2000)]

    expect(alignToVideo(fragments, 87)).toEqual([fragmentAt(1000, 2000)])
  })

  it("keeps the hour when the last line ends a moment after the video", () => {
    const fragments = [fragmentAt(HOUR_MS + 1000, HOUR_MS + 87_500)]

    expect(alignToVideo(fragments, 87)).toEqual([fragmentAt(1000, 87_500)])
  })

  it("leaves captions that no whole-hour shift can place inside the video", () => {
    const fragments = [fragmentAt(30_000, 31_000), fragmentAt(3 * HOUR_MS, 3 * HOUR_MS + 1000)]

    expect(alignToVideo(fragments, 87)).toBe(fragments)
  })

  it("leaves captions that start before the broadcast hour", () => {
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
