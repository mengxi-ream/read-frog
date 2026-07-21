// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { siteRuleSchema } from "@/types/config/site-rules"
import {
  STATE_MESSAGE_CLASS,
  SUBTITLES_VIEW_CLASS,
  TRANSLATE_BUTTON_CLASS,
  YOUTUBE_NATIVE_SUBTITLES_CLASS,
} from "@/utils/constants/subtitles"
import { BUILT_IN_SITE_RULES } from "../built-in"
import rawBuiltInRules from "../built-in/rules.json"
import { normalizeUrlPattern } from "../match"
import { resolveSiteRule } from "../resolve"

const RAW_BUILT_IN_SITE_RULES = rawBuiltInRules as unknown as Array<Record<string, unknown>>
const FORCE_SELECTOR_SUFFIXES = ["", ".add", ".remove"] as const
const LEGACY_FORCE_SELECTOR_KEYS = [
  "forceBlockSelectors",
  "forceBlockSelectors.add",
  "forceBlockSelectors.remove",
  "forceInlineSelectors",
  "forceInlineSelectors.add",
  "forceInlineSelectors.remove",
] as const

function rawSelectorList(rule: Record<string, unknown>, key: string): string[] {
  const value = rule[key]
  return Array.isArray(value) ? value : []
}

function selectorFamilyStats(baseKey: string): { rules: number; selectorStrings: number } {
  const keys = FORCE_SELECTOR_SUFFIXES.map((suffix) => `${baseKey}${suffix}`)
  const matchingRules = RAW_BUILT_IN_SITE_RULES.filter((rule) =>
    keys.some((key) => Object.hasOwn(rule, key)),
  )

  return {
    rules: matchingRules.length,
    selectorStrings: matchingRules.reduce(
      (total, rule) =>
        total + keys.reduce((ruleTotal, key) => ruleTotal + rawSelectorList(rule, key).length, 0),
      0,
    ),
  }
}

function allSelectors(rule: (typeof BUILT_IN_SITE_RULES)[number]): string[] {
  return [
    ...(rule.excludeSelectors ?? []),
    ...(rule["excludeSelectors.add"] ?? []),
    ...(rule["excludeSelectors.remove"] ?? []),
    ...(rule.includeSelectors ?? []),
    ...(rule["includeSelectors.add"] ?? []),
    ...(rule["includeSelectors.remove"] ?? []),
    ...(rule.forceBlockNodeSelectors ?? []),
    ...(rule["forceBlockNodeSelectors.add"] ?? []),
    ...(rule["forceBlockNodeSelectors.remove"] ?? []),
    ...(rule.forceBlockStyleSelectors ?? []),
    ...(rule["forceBlockStyleSelectors.add"] ?? []),
    ...(rule["forceBlockStyleSelectors.remove"] ?? []),
    ...(rule.forceInlineNodeSelectors ?? []),
    ...(rule["forceInlineNodeSelectors.add"] ?? []),
    ...(rule["forceInlineNodeSelectors.remove"] ?? []),
    ...(rule.forceInlineStyleSelectors ?? []),
    ...(rule["forceInlineStyleSelectors.add"] ?? []),
    ...(rule["forceInlineStyleSelectors.remove"] ?? []),
    ...(rule.preserveTextSelectors ?? []),
    ...(rule["preserveTextSelectors.add"] ?? []),
    ...(rule["preserveTextSelectors.remove"] ?? []),
  ]
}

describe("built-in site rules", () => {
  it("all rules pass the schema", () => {
    for (const rule of BUILT_IN_SITE_RULES) {
      const result = siteRuleSchema.safeParse(rule)
      if (!result.success) {
        console.error(`Rule "${rule.id}" failed schema validation:`, result.error.issues)
      }
      expect(result.success).toBe(true)
    }
  })

  it("rule ids are unique", () => {
    const ids = BUILT_IN_SITE_RULES.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("does not ship legacy force selector keys", () => {
    const legacyOccurrences = RAW_BUILT_IN_SITE_RULES.flatMap((rule) =>
      LEGACY_FORCE_SELECTOR_KEYS.filter((key) => Object.hasOwn(rule, key)).map(
        (key) => `${String(rule.id)}: ${key}`,
      ),
    )

    expect(legacyOccurrences).toEqual([])
  })

  it("ships the migrated force selector families with complete coverage", () => {
    expect({
      forceBlockNodeSelectors: selectorFamilyStats("forceBlockNodeSelectors"),
      forceBlockStyleSelectors: selectorFamilyStats("forceBlockStyleSelectors"),
      forceInlineStyleSelectors: selectorFamilyStats("forceInlineStyleSelectors"),
      forceInlineNodeSelectors: selectorFamilyStats("forceInlineNodeSelectors"),
    }).toEqual({
      forceBlockNodeSelectors: { rules: 47, selectorStrings: 75 },
      forceBlockStyleSelectors: { rules: 47, selectorStrings: 75 },
      forceInlineStyleSelectors: { rules: 26, selectorStrings: 45 },
      forceInlineNodeSelectors: { rules: 0, selectorStrings: 0 },
    })
  })

  it("duplicates every migrated force-block selector into node and style channels", () => {
    for (const rule of RAW_BUILT_IN_SITE_RULES) {
      for (const suffix of FORCE_SELECTOR_SUFFIXES) {
        const nodeKey = `forceBlockNodeSelectors${suffix}`
        const styleKey = `forceBlockStyleSelectors${suffix}`
        expect(Object.hasOwn(rule, nodeKey)).toBe(Object.hasOwn(rule, styleKey))
        expect(rawSelectorList(rule, nodeKey)).toEqual(rawSelectorList(rule, styleKey))
      }
    }
  })

  it("preserves representative base and add force-block deltas", () => {
    const cases = [
      { id: "readfrog-github", suffix: "", selectors: ["task-lists"] },
      { id: "stackoverflow", suffix: ".add", selectors: ["span.comment-copy"] },
    ] as const

    for (const { id, suffix, selectors } of cases) {
      const rule = RAW_BUILT_IN_SITE_RULES.find((candidate) => candidate.id === id)
      expect(rule).toBeDefined()
      expect(rawSelectorList(rule!, `forceBlockNodeSelectors${suffix}`)).toEqual(selectors)
      expect(rawSelectorList(rule!, `forceBlockStyleSelectors${suffix}`)).toEqual(selectors)
    }
  })

  it("does not restore ineffective button removals in either block channel", () => {
    for (const id of ["cnbc", "bsky.app"]) {
      const rule = RAW_BUILT_IN_SITE_RULES.find((candidate) => candidate.id === id)
      expect(rule).toBeDefined()
      expect(rule).not.toHaveProperty("forceBlockNodeSelectors.remove")
      expect(rule).not.toHaveProperty("forceBlockStyleSelectors.remove")
    }
  })

  it("keeps migrated inline selectors style-only", () => {
    const wikipedia = BUILT_IN_SITE_RULES.find((rule) => rule.id === "wikipedia")
    expect(wikipedia?.forceInlineStyleSelectors).toEqual([
      ".chemf",
      ".mwe-math-element",
      "[role=math]",
      ".nowrap",
    ])
    expect(wikipedia?.forceInlineNodeSelectors).toBeUndefined()

    const steam = BUILT_IN_SITE_RULES.find((rule) => rule.id === "steampoweredApp")
    expect(steam?.includeSelectors).toBeUndefined()
    expect(steam?.forceInlineStyleSelectors).toEqual([".pulldown"])
    expect(steam?.forceInlineNodeSelectors).toBeUndefined()
  })

  it("every URL pattern normalizes", () => {
    const unsupported: string[] = []
    for (const rule of BUILT_IN_SITE_RULES) {
      const patterns = [
        ...(Array.isArray(rule.matches) ? rule.matches : [rule.matches]),
        ...(rule.excludeMatches ?? []),
      ]
      for (const pattern of patterns) {
        if (normalizeUrlPattern(pattern) === null) {
          unsupported.push(`${rule.id}: ${pattern}`)
        }
      }
    }
    expect(unsupported).toEqual([])
  })

  it("every selector parses", () => {
    const probe = document.createDocumentFragment()
    const invalid: string[] = []
    for (const rule of BUILT_IN_SITE_RULES) {
      for (const selector of allSelectors(rule)) {
        try {
          probe.querySelector(selector)
        } catch {
          invalid.push(`${rule.id}: ${selector}`)
        }
      }
    }
    expect(invalid).toEqual([])
  })

  // CNBC clamps card titles via an INLINE style (-webkit-line-clamp:3), which
  // only an !important declaration can override — without it the rule is a
  // no-op and the injected translation stays clipped.
  // See https://github.com/mengxi-ream/read-frog/issues/1918
  it("unclamps CNBC card titles with !important (issue #1918)", () => {
    const resolved = resolveSiteRule("https://www.cnbc.com/", BUILT_IN_SITE_RULES, [], [])
    expect(resolved.injectedCss).toContain("-webkit-line-clamp: unset !important")
    expect(resolved.injectedCss).toContain("max-height: unset !important")
  })

  // Vercel `prose-vercel` docs hide `[data-docs-heading] a span`, which also
  // hides Read Frog's injected wrapper once it lands inside the heading anchor.
  // See https://github.com/mengxi-ream/read-frog/issues/1050
  it("un-hides translations inside Vercel doc headings (issue #1050)", () => {
    for (const url of [
      "https://ai-sdk.dev/docs/foundations/providers-and-models",
      "https://vercel.com/docs",
    ]) {
      const resolved = resolveSiteRule(url, BUILT_IN_SITE_RULES, [], [])
      expect(resolved.injectedCss).toContain(
        "[data-docs-heading] .read-frog-translated-content-wrapper",
      )
      expect(resolved.injectedCss).toContain("visibility:visible!important")
    }
  })

  it("does not restrict Steam app pages to an obsolete iframe include (issue #1923)", () => {
    const resolved = resolveSiteRule(
      "https://store.steampowered.com/app/2453660/Hoop_Land/",
      BUILT_IN_SITE_RULES,
      [],
      [],
    )

    expect(resolved.matchedRuleIds).toContain("steampoweredApp")
    expect(resolved.includeSelector).toBeNull()
  })

  it("keeps the youtube rule in sync with the subtitle class constants", () => {
    const youtube = BUILT_IN_SITE_RULES.find((rule) => rule.id === "readfrog-youtube")
    expect(youtube).toBeDefined()
    expect(youtube!.excludeSelectors).toEqual(
      expect.arrayContaining([
        YOUTUBE_NATIVE_SUBTITLES_CLASS,
        `.${SUBTITLES_VIEW_CLASS}`,
        `.${STATE_MESSAGE_CLASS}`,
        `.${TRANSLATE_BUTTON_CLASS}`,
      ]),
    )
  })

  it("excludes the hltv.org navigation whose overflow handler loops on width changes (#1831)", () => {
    const resolved = resolveSiteRule(
      "https://www.hltv.org/matches/2395002/furia-vs-falcons-iem-cologne-major-2026",
      BUILT_IN_SITE_RULES,
      [],
      [],
    )
    expect(resolved.excludeSelector).toContain("[data-nav-item]")
    expect(resolved.excludeSelector).toContain("[data-nav-extras]")
    expect(resolved.excludeSelector).toContain(".navbar")
  })

  it("excludes hltv.org comment metadata bars (floor number, author, time, votes)", () => {
    const resolved = resolveSiteRule(
      "https://www.hltv.org/matches/2395002/furia-vs-falcons-iem-cologne-major-2026",
      BUILT_IN_SITE_RULES,
      [],
      [],
    )
    // .forum-topbar carries the floor number (a.replyNum), fan badge, flag and
    // author anchor; .forum-bottombar carries the timestamp (span.time) and the
    // vote button with its login tooltip. Post bodies live outside both bars.
    expect(resolved.excludeSelector).toContain(".forum-topbar")
    expect(resolved.excludeSelector).toContain(".forum-bottombar")
  })

  it("does not restrict migrated sites to stale include selectors", () => {
    const restoredSites = [
      ["newyorker", "https://www.newyorker.com/news/the-lede/example"],
      ["scmp", "https://www.scmp.com/news/china/politics/article/example"],
      ["android", "https://developer.android.com/develop/ui/compose/documentation"],
      ["thehackernews", "https://thehackernews.com/2026/07/example.html"],
      ["artstationLearning", "https://www.artstation.com/learning/courses/example"],
      ["artstationBlog", "https://www.artstation.com/blogs/example/example"],
      ["figmaCommunity", "https://www.figma.com/community/file/example"],
      ["construct", "https://www.construct.net/en/forum"],
      ["construct", "https://www.construct.net/en/make-games/manuals/construct-3"],
      ["wandb", "https://wandb.ai/site/reports/"],
      [
        "wandb",
        "https://wandb.ai/stacey/estuary/reports/When-Inception-ResNet-V2-is-too-slow--Vmlldzo3MDcxMA",
      ],
    ] as const

    for (const [id, url] of restoredSites) {
      const resolved = resolveSiteRule(url, BUILT_IN_SITE_RULES, [], [])
      expect(resolved.matchedRuleIds).toContain(id)
      expect(resolved.includeSelector).toBeNull()
    }
  })

  it("matches current Microsoft Store URLs without a dead PRE-only scope", () => {
    for (const url of [
      "https://apps.microsoft.com/store/detail/example/9nksqgp7f2nh",
      "https://apps.microsoft.com/detail/9nksqgp7f2nh",
    ]) {
      const microsoft = resolveSiteRule(url, BUILT_IN_SITE_RULES, [], [])

      expect(microsoft.matchedRuleIds).toContain("microsoft")
      expect(microsoft.includeSelector).toBeNull()
    }
  })

  it("uses class selectors for ArtStation blog card chrome", () => {
    const rule = BUILT_IN_SITE_RULES.find((candidate) => candidate.id === "artstationBlog")
    expect(rule?.excludeSelectors).toContain(".blog-card-thumbnail")
    expect(rule?.excludeSelectors).toContain(".blog-card-header")
    expect(rule?.excludeSelectors).not.toContain("blog-card-thumbnail")
    expect(rule?.excludeSelectors).not.toContain("blog-card-header")

    const resolved = resolveSiteRule(
      "https://www.artstation.com/blogs",
      BUILT_IN_SITE_RULES,
      [],
      [],
    )
    expect(resolved.excludeSelector).toContain(".blog-card-thumbnail")
    expect(resolved.excludeSelector).toContain(".blog-card-header")
  })

  it("does not ship a strict scope that only targets hard-blocked PRE content", () => {
    const preOnlyRules = BUILT_IN_SITE_RULES.filter(
      (rule) =>
        rule.includeSelectors?.length === 1 &&
        rule.includeSelectors[0].trim().toLowerCase() === "pre",
    )

    expect(preOnlyRules).toEqual([])
  })

  it("retains independently verified content roots that cover their full match scope", () => {
    const paulGraham = resolveSiteRule(
      "https://paulgraham.com/greatwork.html",
      BUILT_IN_SITE_RULES,
      [],
      [],
    )
    expect(paulGraham.includeSelector).toBe("font[face=verdana]")

    const ubuntu = resolveSiteRule(
      "https://manpages.ubuntu.com/manpages/noble/man1/ls.1.html",
      BUILT_IN_SITE_RULES,
      [],
      [],
    )
    expect(ubuntu.matchedRuleIds).toContain("ubuntu")
    expect(ubuntu.includeSelector).toBe("#manpage-content")
  })
})
