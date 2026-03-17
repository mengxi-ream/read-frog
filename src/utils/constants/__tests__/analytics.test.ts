import { describe, expect, it } from "vitest"
import { getDefaultAnalyticsEnabled } from "../analytics"

describe("analytics constants", () => {
  it("enables analytics by default outside Firefox", () => {
    expect(getDefaultAnalyticsEnabled("chrome")).toBe(true)
    expect(getDefaultAnalyticsEnabled("edge")).toBe(true)
  })

  it("disables analytics by default on Firefox", () => {
    expect(getDefaultAnalyticsEnabled("firefox")).toBe(false)
  })
})
