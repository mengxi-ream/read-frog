import type { SiteRule } from "@/types/config/site-rules"
import { describe, expect, it } from "vitest"
import { MAX_SITE_RULES_JSON_LENGTH, MAX_USER_SITE_RULES } from "@/types/config/site-rules"
import { validateUserRulesDocument } from "../validate-user-rules"

describe("validateUserRulesDocument", () => {
  it("treats an empty or whitespace-only document as no rules", () => {
    expect(validateUserRulesDocument("")).toEqual({ ok: true, rules: [] })
    expect(validateUserRulesDocument("  \n\t  ")).toEqual({ ok: true, rules: [] })
  })

  it("reports JSON syntax errors", () => {
    const result = validateUserRulesDocument("{")

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("syntax")
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].message.length).toBeGreaterThan(0)
  })

  it("rejects a non-array top-level value", () => {
    const result = validateUserRulesDocument("{}")

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("notArray")
    expect(result.issues).toHaveLength(1)
  })

  it("rejects documents longer than the JSON length cap", () => {
    const text = JSON.stringify([{ id: "big", matches: "x".repeat(MAX_SITE_RULES_JSON_LENGTH) }])
    expect(text.length).toBeGreaterThan(MAX_SITE_RULES_JSON_LENGTH)

    const result = validateUserRulesDocument(text)

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("tooLong")
  })

  it("rejects more rules than the rule count cap", () => {
    const rules = Array.from({ length: MAX_USER_SITE_RULES + 1 }, (_, index) => ({
      id: `rule-${index}`,
      matches: "example.com",
    }))

    const result = validateUserRulesDocument(JSON.stringify(rules))

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("tooMany")
  })

  it("reports one issue per duplicate rule id", () => {
    const rules = [
      { id: "dup", matches: "a.example.com" },
      { id: "dup", matches: "b.example.com" },
      { id: "unique", matches: "c.example.com" },
    ]

    const result = validateUserRulesDocument(JSON.stringify(rules))

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("duplicateIds")
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].path).toBe("rules[1].id")
    expect(result.issues[0].message).toContain("dup")
  })

  it("formats schema issue paths as rules[n].field", () => {
    const rules = [
      { id: "ok", matches: "example.com" },
      { id: "broken", matches: 42 },
    ]

    const result = validateUserRulesDocument(JSON.stringify(rules))

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("schema")
    expect(result.issues[0].path).toBe("rules[1].matches")
    // The editor renders each issue as `${path}: ${message}`.
    expect(
      `${result.issues[0].path}: ${result.issues[0].message}`.startsWith("rules[1].matches: "),
    ).toBe(true)
  })

  it("rejects unknown rule fields instead of silently stripping them", () => {
    const result = validateUserRulesDocument(
      JSON.stringify([
        {
          id: "typo",
          matches: "example.com",
          forceBlockStyleSelectros: [".typo"],
        },
      ]),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("schema")
    expect(result.issues).toEqual([
      {
        path: "rules[0].forceBlockStyleSelectros",
        message: 'Unrecognized field "forceBlockStyleSelectros"',
      },
    ])
  })

  it("reports invalid legacy selector values at their legacy field paths", () => {
    const result = validateUserRulesDocument(
      JSON.stringify([
        {
          id: "invalid-legacy",
          matches: "example.com",
          forceBlockSelectors: ".not-an-array",
        },
      ]),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.kind).toBe("schema")
    expect(result.issues[0].path).toBe("rules[0].forceBlockSelectors")
  })

  it("round-trips a valid rules document", () => {
    const rules: SiteRule[] = [
      {
        id: "example",
        description: "Example rule",
        matches: ["example.com", "*.example.org"],
        excludeSelectors: [".ad"],
        minCharacters: 3,
        enabled: true,
      },
      { id: "minimal", matches: "minimal.example.com" },
    ]

    const result = validateUserRulesDocument(JSON.stringify(rules, null, 2))

    expect(result).toEqual({ ok: true, rules })
  })

  it("migrates legacy force selector fields to canonical editor output", () => {
    const result = validateUserRulesDocument(
      JSON.stringify([
        {
          id: "legacy",
          matches: "example.com",
          forceBlockSelectors: [".block"],
          "forceBlockSelectors.add": [".block-added"],
          "forceBlockSelectors.remove": [".block-removed"],
          forceInlineSelectors: [".inline"],
          "forceInlineSelectors.add": [".inline-added"],
          "forceInlineSelectors.remove": [".inline-removed"],
        },
      ]),
    )

    expect(result).toEqual({
      ok: true,
      rules: [
        {
          id: "legacy",
          matches: "example.com",
          forceBlockNodeSelectors: [".block"],
          "forceBlockNodeSelectors.add": [".block-added"],
          "forceBlockNodeSelectors.remove": [".block-removed"],
          forceBlockStyleSelectors: [".block"],
          "forceBlockStyleSelectors.add": [".block-added"],
          "forceBlockStyleSelectors.remove": [".block-removed"],
          forceInlineStyleSelectors: [".inline"],
          "forceInlineStyleSelectors.add": [".inline-added"],
          "forceInlineStyleSelectors.remove": [".inline-removed"],
        },
      ],
    })
    if (!result.ok) {
      return
    }
    expect(validateUserRulesDocument(JSON.stringify(result.rules))).toEqual(result)
  })

  it("keeps explicitly authored canonical selector values per corresponding key", () => {
    const result = validateUserRulesDocument(
      JSON.stringify([
        {
          id: "mixed",
          matches: "example.com",
          forceBlockSelectors: [".old-block"],
          "forceBlockSelectors.add": [".old-block-add"],
          "forceBlockSelectors.remove": [".old-block-remove"],
          forceBlockNodeSelectors: [".new-block-node"],
          "forceBlockNodeSelectors.remove": [".new-block-node-remove"],
          "forceBlockStyleSelectors.add": [".new-block-style-add"],
          forceInlineSelectors: [".old-inline"],
          "forceInlineSelectors.add": [".old-inline-add"],
          "forceInlineSelectors.remove": [".old-inline-remove"],
          forceInlineNodeSelectors: [".new-inline-node"],
          forceInlineStyleSelectors: [".new-inline-style"],
          "forceInlineStyleSelectors.remove": [".new-inline-style-remove"],
        },
      ]),
    )

    expect(result).toEqual({
      ok: true,
      rules: [
        {
          id: "mixed",
          matches: "example.com",
          forceBlockNodeSelectors: [".new-block-node"],
          "forceBlockNodeSelectors.add": [".old-block-add"],
          "forceBlockNodeSelectors.remove": [".new-block-node-remove"],
          forceBlockStyleSelectors: [".old-block"],
          "forceBlockStyleSelectors.add": [".new-block-style-add"],
          "forceBlockStyleSelectors.remove": [".old-block-remove"],
          forceInlineNodeSelectors: [".new-inline-node"],
          forceInlineStyleSelectors: [".new-inline-style"],
          "forceInlineStyleSelectors.add": [".old-inline-add"],
          "forceInlineStyleSelectors.remove": [".new-inline-style-remove"],
        },
      ],
    })
  })
})
