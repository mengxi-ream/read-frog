// @vitest-environment jsdom
import type { SiteRule } from "@/types/config/site-rules"
import { describe, expect, it } from "vitest"
import { siteRuleSchema } from "@/types/config/site-rules"
import { EMPTY_RESOLVED_SITE_RULE, resolveSiteRule } from "../resolve"

const URL_ON_SITE = "https://example.com/article"

function rule(partial: Partial<SiteRule> & { id: string }): SiteRule {
  return { matches: "example.com", ...partial }
}

describe("resolveSiteRule", () => {
  it("returns the empty rule when nothing matches", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [rule({ id: "other", matches: "other.com" })],
      [],
      [],
    )
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

  it("concatenates injectedCss.add in matched rule order", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [
        rule({
          id: "built-in",
          injectedCss: ".a { color: red; }",
          "injectedCss.add": [".b { color: blue; }"],
        }),
      ],
      [rule({ id: "user", "injectedCss.add": [".c { color: green; }"] })],
      [],
    )
    expect(resolved.injectedCss).toBe(
      ".a { color: red; }\n.b { color: blue; }\n.c { color: green; }",
    )
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

  it("applies selector add and remove deltas in rule order", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [
        rule({
          id: "built-in-a",
          excludeSelectors: ["nav", ".ads"],
          "excludeSelectors.add": [".promo"],
          "excludeSelectors.remove": [".ads"],
        }),
        rule({
          id: "built-in-b",
          "excludeSelectors.add": [".toast"],
        }),
      ],
      [
        rule({
          id: "user",
          "excludeSelectors.remove": ["nav"],
          "excludeSelectors.add": ["footer"],
        }),
      ],
      [],
    )
    expect(resolved.excludeSelector).toBe(".promo,.toast,footer")
  })

  it("supports add and remove deltas for every selector family", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [
        rule({
          id: "built-in",
          includeSelectors: ["article"],
          "includeSelectors.add": [".content"],
          "includeSelectors.remove": ["article"],
          forceBlockNodeSelectors: [".block-node"],
          "forceBlockNodeSelectors.add": [".block-node-added"],
          "forceBlockNodeSelectors.remove": [".block-node"],
          forceBlockStyleSelectors: [".block-style"],
          "forceBlockStyleSelectors.add": [".block-style-added"],
          "forceBlockStyleSelectors.remove": [".block-style"],
          forceInlineNodeSelectors: [".inline-node"],
          "forceInlineNodeSelectors.add": [".inline-node-added"],
          "forceInlineNodeSelectors.remove": [".inline-node"],
          forceInlineStyleSelectors: [".inline-style"],
          "forceInlineStyleSelectors.add": [".inline-style-added"],
          "forceInlineStyleSelectors.remove": [".inline-style"],
          preserveTextSelectors: [".code"],
          "preserveTextSelectors.add": [".math"],
          "preserveTextSelectors.remove": [".code"],
        }),
      ],
      [],
      [],
    )

    expect(resolved.includeSelector).toBe(".content")
    expect(resolved.forceBlockNodeSelector).toBe(".block-node-added")
    expect(resolved.forceBlockStyleSelector).toBe(".block-style-added")
    expect(resolved.forceInlineNodeSelector).toBe(".inline-node-added")
    expect(resolved.forceInlineStyleSelector).toBe(".inline-style-added")
    expect(resolved.preserveTextSelector).toBe(".math")
  })

  it("merges all four force selector axes independently", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [
        rule({
          id: "built-in",
          forceBlockNodeSelectors: [".block-node"],
          forceBlockStyleSelectors: [".block-style"],
        }),
      ],
      [
        rule({
          id: "user",
          forceInlineNodeSelectors: [".inline-node"],
          forceInlineStyleSelectors: [".inline-style"],
        }),
      ],
      [],
    )

    expect(resolved.forceBlockNodeSelector).toBe(".block-node")
    expect(resolved.forceBlockStyleSelector).toBe(".block-style")
    expect(resolved.forceInlineNodeSelector).toBe(".inline-node")
    expect(resolved.forceInlineStyleSelector).toBe(".inline-style")
  })

  it("drops invalid selectors independently on all four force axes", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [],
      [
        rule({
          id: "user",
          forceBlockNodeSelectors: ["bad-base[", ".removed-block-node"],
          "forceBlockNodeSelectors.add": ["bad-add[", ".block-node"],
          "forceBlockNodeSelectors.remove": ["bad-remove[", ".removed-block-node"],
          forceBlockStyleSelectors: ["bad-base[", ".removed-block-style"],
          "forceBlockStyleSelectors.add": ["bad-add[", ".block-style"],
          "forceBlockStyleSelectors.remove": ["bad-remove[", ".removed-block-style"],
          forceInlineNodeSelectors: ["bad-base[", ".removed-inline-node"],
          "forceInlineNodeSelectors.add": ["bad-add[", ".inline-node"],
          "forceInlineNodeSelectors.remove": ["bad-remove[", ".removed-inline-node"],
          forceInlineStyleSelectors: ["bad-base[", ".removed-inline-style"],
          "forceInlineStyleSelectors.add": ["bad-add[", ".inline-style"],
          "forceInlineStyleSelectors.remove": ["bad-remove[", ".removed-inline-style"],
        }),
      ],
      [],
    )

    expect(resolved.forceBlockNodeSelector).toBe(".block-node")
    expect(resolved.forceBlockStyleSelector).toBe(".block-style")
    expect(resolved.forceInlineNodeSelector).toBe(".inline-node")
    expect(resolved.forceInlineStyleSelector).toBe(".inline-style")
  })

  it("allows a later rule to re-add selectors removed by an earlier rule", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [
        rule({
          id: "base",
          forceBlockNodeSelectors: [".block-node"],
          forceBlockStyleSelectors: [".block-style"],
          forceInlineNodeSelectors: [".inline-node"],
          forceInlineStyleSelectors: [".inline-style"],
        }),
      ],
      [
        rule({
          id: "remove",
          "forceBlockNodeSelectors.remove": [".block-node"],
          "forceBlockStyleSelectors.remove": [".block-style"],
          "forceInlineNodeSelectors.remove": [".inline-node"],
          "forceInlineStyleSelectors.remove": [".inline-style"],
        }),
        rule({
          id: "re-add",
          "forceBlockNodeSelectors.add": [".block-node"],
          "forceBlockStyleSelectors.add": [".block-style"],
          "forceInlineNodeSelectors.add": [".inline-node"],
          "forceInlineStyleSelectors.add": [".inline-style"],
        }),
      ],
      [],
    )

    expect(resolved.forceBlockNodeSelector).toBe(".block-node")
    expect(resolved.forceBlockStyleSelector).toBe(".block-style")
    expect(resolved.forceInlineNodeSelector).toBe(".inline-node")
    expect(resolved.forceInlineStyleSelector).toBe(".inline-style")
  })

  it("keeps selector syntax validation out of the lenient storage schema", () => {
    const parsed = siteRuleSchema.safeParse({
      id: "user",
      matches: "example.com",
      forceBlockNodeSelectors: ["bad["],
      forceBlockStyleSelectors: ["bad["],
      forceInlineNodeSelectors: ["bad["],
      forceInlineStyleSelectors: ["bad["],
    })

    expect(parsed.success).toBe(true)
  })

  it("does not retain the pre-v87 force selector aliases in the canonical schema", () => {
    const parsed = siteRuleSchema.parse({
      id: "legacy",
      matches: "example.com",
      forceBlockSelectors: [".legacy-block"],
      "forceBlockSelectors.add": [".legacy-block-add"],
      "forceInlineSelectors.remove": [".legacy-inline-remove"],
    })

    expect(parsed).not.toHaveProperty("forceBlockSelectors")
    expect(parsed).not.toHaveProperty("forceBlockSelectors.add")
    expect(parsed).not.toHaveProperty("forceInlineSelectors.remove")
  })

  it("drops invalid selector deltas without killing valid siblings", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [],
      [
        rule({
          id: "user",
          "preserveTextSelectors.add": ["bad[", ".token"],
          "preserveTextSelectors.remove": ["bad["],
        }),
      ],
      [],
    )
    expect(resolved.preserveTextSelector).toBe(".token")
  })

  it("merges include and force selectors independently", () => {
    const resolved = resolveSiteRule(
      URL_ON_SITE,
      [
        rule({
          id: "built-in",
          includeSelectors: ["article"],
          forceBlockNodeSelectors: [".post"],
        }),
      ],
      [rule({ id: "user", forceInlineStyleSelectors: [".tag"] })],
      [],
    )
    expect(resolved.includeSelector).toBe("article")
    expect(resolved.forceBlockNodeSelector).toBe(".post")
    expect(resolved.forceInlineStyleSelector).toBe(".tag")
    expect(resolved.forceBlockStyleSelector).toBeNull()
    expect(resolved.forceInlineNodeSelector).toBeNull()
  })
})
