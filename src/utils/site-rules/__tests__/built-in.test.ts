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
import { normalizeUrlPattern } from "../match"
import { resolveSiteRule } from "../resolve"

function allSelectors(rule: (typeof BUILT_IN_SITE_RULES)[number]): string[] {
  return [
    ...(rule.excludeSelectors ?? []),
    ...(rule["excludeSelectors.add"] ?? []),
    ...(rule["excludeSelectors.remove"] ?? []),
    ...(rule.includeSelectors ?? []),
    ...(rule["includeSelectors.add"] ?? []),
    ...(rule["includeSelectors.remove"] ?? []),
    ...(rule.forceBlockSelectors ?? []),
    ...(rule["forceBlockSelectors.add"] ?? []),
    ...(rule["forceBlockSelectors.remove"] ?? []),
    ...(rule.forceInlineSelectors ?? []),
    ...(rule["forceInlineSelectors.add"] ?? []),
    ...(rule["forceInlineSelectors.remove"] ?? []),
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
})
