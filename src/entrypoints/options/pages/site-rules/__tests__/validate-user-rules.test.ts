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
    expect(result.issues[0]!.message.length).toBeGreaterThan(0)
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
    expect(result.issues[0]!.path).toBe("rules[1].id")
    expect(result.issues[0]!.message).toContain("dup")
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
    expect(result.issues[0]!.path).toBe("rules[1].matches")
    // The editor renders each issue as `${path}: ${message}`.
    expect(`${result.issues[0]!.path}: ${result.issues[0]!.message}`.startsWith("rules[1].matches: ")).toBe(true)
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
})
