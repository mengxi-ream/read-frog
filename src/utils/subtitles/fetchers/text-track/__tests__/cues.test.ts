import { describe, expect, it } from "vitest"
import { cuesToFragments } from "../cues"

function cue(startTime: number, endTime: number, text: string): TextTrackCue {
  return { startTime, endTime, text } as unknown as TextTrackCue
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
