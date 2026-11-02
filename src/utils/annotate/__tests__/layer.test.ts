import { describe, expect, it } from "vitest"
import { allocateGlossWidths, mergeLineRects, toneForColor } from "../layer"

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height } as DOMRect
}

describe("mergeLineRects", () => {
  it("merges the fragments of one line and keeps lines apart", () => {
    const lines = mergeLineRects([
      rect(10, 0, 30, 18),
      rect(40, 1, 20, 16), // a bold fragment, slightly shorter
      rect(0, 0, 0, 18), // an empty boundary rect
      rect(0, 24, 50, 18),
    ])

    expect(lines).toEqual([
      { left: 10, right: 60, top: 0, bottom: 18 },
      { left: 0, right: 50, top: 24, bottom: 42 },
    ])
  })
})

describe("toneForColor", () => {
  it("tells light text (a dark page) from dark text", () => {
    expect(toneForColor("rgb(34, 34, 34)")).toBe("light")
    expect(toneForColor("rgb(227, 235, 232)")).toBe("dark")
    expect(toneForColor("rgba(255, 255, 255, 0.9)")).toBe("dark")
    expect(toneForColor("rgb(120 120 120 / 1)")).toBe("light")
    expect(toneForColor("oklch(0.9 0 0)")).toBe("light")
  })
})

describe("allocateGlossWidths", () => {
  it("lets a lone gloss have its natural width", () => {
    expect(allocateGlossWidths([{ center: 100, y: 20, natural: 60, wordWidth: 30 }])).toEqual([60])
  })

  it("is never narrower than its word, so a short meaning replaces the skeleton in place", () => {
    expect(allocateGlossWidths([{ center: 100, y: 20, natural: 18, wordWidth: 40 }])).toEqual([40])
    expect(allocateGlossWidths([{ center: 100, y: 20, natural: 0, wordWidth: 40 }])).toEqual([40])
  })

  it("shares the distance between neighbours on one line, less a gap", () => {
    const widths = allocateGlossWidths([
      { center: 100, y: 20, natural: 80, wordWidth: 30 },
      { center: 150, y: 20, natural: 80, wordWidth: 30 },
    ])
    // 50 apart, 6 of gap: each may take 44, and together they do not touch.
    expect(widths).toEqual([44, 44])
    expect(widths[0]! / 2 + widths[1]! / 2).toBeLessThanOrEqual(50 - 6)
  })

  it("ignores neighbours on other lines and never goes under the word", () => {
    const widths = allocateGlossWidths([
      { center: 100, y: 20, natural: 80, wordWidth: 30 },
      { center: 105, y: 44, natural: 80, wordWidth: 30 },
      { center: 110, y: 20, natural: 80, wordWidth: 30 },
    ])
    expect(widths[1]).toBe(80)
    expect(widths[0]).toBe(30)
    expect(widths[2]).toBe(30)
  })
})
