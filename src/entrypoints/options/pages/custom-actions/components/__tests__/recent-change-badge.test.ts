// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { isRecentChangeVisible } from "../recent-change-badge"

describe("recent change badge window", () => {
  it("starts at local midnight on September 27 and ends at local midnight 30 days later", () => {
    const date = "2026-09-27"
    expect(isRecentChangeVisible(date, new Date(2026, 8, 26, 23, 59, 59, 999))).toBe(false)
    expect(isRecentChangeVisible(date, new Date(2026, 8, 27))).toBe(true)
    expect(isRecentChangeVisible(date, new Date(2026, 9, 26, 23, 59, 59, 999))).toBe(true)
    expect(isRecentChangeVisible(date, new Date(2026, 9, 27))).toBe(false)
  })

  it("uses the date supplied by the caller", () => {
    expect(isRecentChangeVisible("2026-09-28", new Date(2026, 8, 27))).toBe(false)
    expect(isRecentChangeVisible("2026-09-28", new Date(2026, 8, 28))).toBe(true)
    expect(isRecentChangeVisible("2026-09-28", new Date(2026, 9, 28))).toBe(false)
  })
})
