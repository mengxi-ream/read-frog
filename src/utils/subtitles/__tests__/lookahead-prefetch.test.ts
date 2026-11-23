import { describe, expect, it } from "vitest"
import { configuredLookAheadMs } from "../lookahead"

describe("configurable subtitle prefetch", () => {
  it("preserves regular 1x and 3x look-ahead by default", () => {
    expect(configuredLookAheadMs(30_000, 1, 0)).toBe(30_000)
    expect(configuredLookAheadMs(30_000, 3, 0)).toBe(90_000)
  })

  it("uses a custom horizon without shrinking the adaptive window", () => {
    expect(configuredLookAheadMs(30_000, 1, 5)).toBe(300_000)
    expect(configuredLookAheadMs(30_000, 4, 2)).toBe(120_000)
  })

  it("supports the full available ASR track", () => {
    expect(configuredLookAheadMs(30_000, 1, -1)).toBe(Number.POSITIVE_INFINITY)
  })
})
