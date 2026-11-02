import { describe, expect, it } from "vitest"
import { gapOf, leadingRungFor, REQUIRED_GAP_PX } from "../leading"
import { LEADING_LADDER_MAX, LEADING_LADDER_MIN } from "../styles"

describe("leadingRungFor", () => {
  it("leaves a line alone when the gap under it already fits a gloss", () => {
    const measurement = {
      fontSize: 16,
      lineHeight: 16 * 1.15 + REQUIRED_GAP_PX,
      inkHeight: 16 * 1.15,
    }
    expect(gapOf(measurement)).toBeCloseTo(REQUIRED_GAP_PX)
    expect(leadingRungFor(measurement)).toBeNull()
  })

  it("treats line-height: normal as leaving no gap", () => {
    expect(gapOf({ fontSize: 16, lineHeight: null, inkHeight: 18 })).toBe(0)
  })

  it("rounds the needed line-height up to the rung above", () => {
    // (18 + 18) / 16 = 2.25 → 2.3
    const rung = leadingRungFor({ fontSize: 16, lineHeight: 24, inkHeight: 18 })
    expect(rung).toBe(Math.ceil(((18 + REQUIRED_GAP_PX) / 16) * 10))
  })

  it("never leaves the ladder", () => {
    expect(leadingRungFor({ fontSize: 100, lineHeight: 100, inkHeight: 100 })).toBe(
      LEADING_LADDER_MIN,
    )
    expect(leadingRungFor({ fontSize: 11, lineHeight: 11, inkHeight: 40 })).toBe(LEADING_LADDER_MAX)
    expect(leadingRungFor({ fontSize: 0, lineHeight: 0, inkHeight: 10 })).toBeNull()
  })
})
