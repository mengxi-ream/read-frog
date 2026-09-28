// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { isBuiltInActionBadgeVisible } from "../built-in-action-badge"

describe("built-in action badge window", () => {
  it("starts at local midnight on September 27 and ends at local midnight 30 days later", () => {
    expect(isBuiltInActionBadgeVisible(new Date(2026, 8, 26, 23, 59, 59, 999))).toBe(false)
    expect(isBuiltInActionBadgeVisible(new Date(2026, 8, 27))).toBe(true)
    expect(isBuiltInActionBadgeVisible(new Date(2026, 9, 26, 23, 59, 59, 999))).toBe(true)
    expect(isBuiltInActionBadgeVisible(new Date(2026, 9, 27))).toBe(false)
  })
})
