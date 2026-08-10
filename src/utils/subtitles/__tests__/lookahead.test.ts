import { describe, expect, it } from "vitest"
import { MAX_LOOKAHEAD_RATE } from "@/utils/constants/subtitles"
import { effectiveLookAheadMs } from "../lookahead"

describe("effectiveLookAheadMs", () => {
  it("scales the base window linearly with playback rate", () => {
    expect(effectiveLookAheadMs(30_000, 1)).toBe(30_000)
    expect(effectiveLookAheadMs(30_000, 2)).toBe(60_000)
    expect(effectiveLookAheadMs(30_000, 3)).toBe(90_000)
  })

  it("falls back to 1x when playback rate is undefined or zero", () => {
    expect(effectiveLookAheadMs(30_000, undefined)).toBe(30_000)
    expect(effectiveLookAheadMs(30_000, 0)).toBe(30_000)
  })

  it("never shrinks the window below 1x for slow playback", () => {
    expect(effectiveLookAheadMs(30_000, 0.5)).toBe(30_000)
    expect(effectiveLookAheadMs(30_000, 0.25)).toBe(30_000)
  })

  it("clamps extreme playback rates at MAX_LOOKAHEAD_RATE", () => {
    expect(effectiveLookAheadMs(30_000, 8)).toBe(30_000 * MAX_LOOKAHEAD_RATE)
    expect(effectiveLookAheadMs(30_000, 16)).toBe(30_000 * MAX_LOOKAHEAD_RATE)
  })
})
