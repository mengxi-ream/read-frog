// @vitest-environment jsdom
import type { SiteRule } from "@/types/config/site-rules"
import { describe, expect, it } from "vitest"
import { EMPTY_RESOLVED_SITE_RULE, resolveSiteRule } from "../resolve"

const URL_ON_SITE = "https://example.com/article"

function rule(partial: Partial<SiteRule> & { id: string }): SiteRule {
  return { matches: "example.com", ...partial }
}

describe("resolveSiteRule", () => {
  it("returns the empty rule when nothing matches", () => {
    const resolved = resolveSiteRule(URL_ON_SITE, [rule({ id: "other", matches: "other.com" })], [], [])
    expect(resolved).toBe(EMPTY_RESOLVED_SITE_RULE)
  })

  it("unions and dedupes selector arrays across matching rules", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [rule({ id: "built-in", excludeSelectors: ["nav", ".sidebar"] })],
      [rule({ id: "user", excludeSelectors: [".sidebar", "footer"] })],
      [],
    )
    expect(resolved.excludeSelector).toBe("nav,.sidebar,footer")
    expect(resolved.matchedRuleIds).toEqual(["built-in", "user"])
  })

  it("applies scalars last-wins so user rules beat built-in rules", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [rule({ id: "built-in", minCharacters: 10, minWords: 3 })],
      [rule({ id: "user-a", minCharacters: 1 }), rule({ id: "user-b", minCharacters: 2 })],
      [],
    )
    expect(resolved.minCharacters).toBe(2)
    expect(resolved.minWords).toBe(3)
  })

  it("concatenates injectedCss instead of replacing it", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [rule({ id: "built-in", injectedCss: ".a { color: red; }" })],
      [rule({ id: "user", injectedCss: ".b { color: blue; }" })],
      [],
    )
    expect(resolved.injectedCss).toBe(".a { color: red; }\n.b { color: blue; }")
  })

  it("skips disabled built-in rules", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [rule({ id: "built-in", excludeSelectors: ["nav"] })],
      [rule({ id: "user", excludeSelectors: ["footer"] })],
      ["built-in"],
    )
    expect(resolved.excludeSelector).toBe("footer")
    expect(resolved.matchedRuleIds).toEqual(["user"])
  })

  it("skips user rules with enabled: false", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [],
      [rule({ id: "user", enabled: false, excludeSelectors: ["nav"] })],
      [],
    )
    expect(resolved).toBe(EMPTY_RESOLVED_SITE_RULE)
  })

  it("drops invalid selectors without killing valid siblings", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [],
      [rule({ id: "user", excludeSelectors: ["nav", "bad[", "  ", "footer"] })],
      [],
    )
    expect(resolved.excludeSelector).toBe("nav,footer")
  })

  it("merges include and force selectors independently", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [rule({ id: "built-in", includeSelectors: ["article"], forceBlockSelectors: [".post"] })],
      [rule({ id: "user", forceInlineSelectors: [".tag"] })],
      [],
    )
    expect(resolved.includeSelector).toBe("article")
    expect(resolved.forceBlockSelector).toBe(".post")
    expect(resolved.forceInlineSelector).toBe(".tag")
  })
})
