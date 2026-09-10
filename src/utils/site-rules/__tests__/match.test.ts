import { describe, expect, it } from "vitest"
import { urlMatchesRule } from "../match"

describe("urlMatchesRule", () => {
  it("accepts a single pattern or an array of patterns", () => {
    expect(urlMatchesRule("https://x.com/home", { matches: "x.com" })).toBe(true)
    expect(urlMatchesRule("https://x.com/home", { matches: ["twitter.com", "x.com"] })).toBe(true)
    expect(urlMatchesRule("https://x.com/home", { matches: ["twitter.com"] })).toBe(false)
  })

  it("carves out excludeMatches", () => {
    const rule = {
      matches: "github.com",
      excludeMatches: ["github.com/settings/*", "github.com/*/*/settings"],
    }
    expect(urlMatchesRule("https://github.com/foo/bar", rule)).toBe(true)
    expect(urlMatchesRule("https://github.com/settings/profile", rule)).toBe(false)
    expect(urlMatchesRule("https://github.com/foo/bar/settings", rule)).toBe(false)
  })
})
