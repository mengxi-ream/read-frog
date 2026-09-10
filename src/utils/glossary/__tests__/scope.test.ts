import type { GlossaryEntry } from "../types"
import { describe, expect, it } from "vitest"
import { isGlossaryActiveForUrl, mergeGlossaryTerms } from "../scope"

function entry(matchKey: string, target: string): GlossaryEntry {
  return { matchKey, source: matchKey.slice(2), target, caseSensitive: false }
}

describe("isGlossaryActiveForUrl", () => {
  it("applies everywhere when no site is listed", () => {
    const glossary = { enabled: true, matchPatterns: [] }

    expect(isGlossaryActiveForUrl(glossary, "https://example.com/a")).toBe(true)
    expect(isGlossaryActiveForUrl(glossary, "https://anything.else/")).toBe(true)
  })

  it("applies only to the listed sites once one is listed", () => {
    const glossary = { enabled: true, matchPatterns: ["*.example.com"] }

    expect(isGlossaryActiveForUrl(glossary, "https://example.com/a")).toBe(true)
    expect(isGlossaryActiveForUrl(glossary, "https://www.example.com/a")).toBe(true)
    expect(isGlossaryActiveForUrl(glossary, "https://other.com/a")).toBe(false)
  })

  it("honours a path-scoped pattern", () => {
    const glossary = { enabled: true, matchPatterns: ["*.fandom.com/wiki/*"] }

    expect(isGlossaryActiveForUrl(glossary, "https://elderscrolls.fandom.com/wiki/Skyrim")).toBe(
      true,
    )
    expect(isGlossaryActiveForUrl(glossary, "https://elderscrolls.fandom.com/f/p/1")).toBe(false)
  })

  it("never applies while switched off", () => {
    expect(
      isGlossaryActiveForUrl({ enabled: false, matchPatterns: [] }, "https://example.com/"),
    ).toBe(false)
    expect(
      isGlossaryActiveForUrl(
        { enabled: false, matchPatterns: ["*.example.com"] },
        "https://example.com/",
      ),
    ).toBe(false)
  })

  /**
   * Where there is no page — the background resolving a prompt it was not
   * handed terms for, or an extension page like the Translation Hub — a
   * site-scoped glossary must not leak in.
   */
  it("lets only unscoped glossaries through when there is no URL", () => {
    expect(isGlossaryActiveForUrl({ enabled: true, matchPatterns: [] }, undefined)).toBe(true)
    expect(
      isGlossaryActiveForUrl({ enabled: true, matchPatterns: ["*.example.com"] }, undefined),
    ).toBe(false)
  })

  it("treats an unmatchable URL the same as no URL for a scoped glossary", () => {
    const glossary = { enabled: true, matchPatterns: ["*.example.com"] }

    expect(isGlossaryActiveForUrl(glossary, "chrome-extension://abc/options.html")).toBe(false)
    expect(isGlossaryActiveForUrl(glossary, "about:blank")).toBe(false)
    expect(isGlossaryActiveForUrl(glossary, "not a url")).toBe(false)
  })
})

describe("mergeGlossaryTerms", () => {
  it("keeps the later glossary's wording when both claim a term", () => {
    const merged = mergeGlossaryTerms([
      [entry("i:chort bay", "乔特湾")],
      [entry("i:chort bay", "雀特湾")],
    ])

    expect(merged).toEqual([entry("i:chort bay", "雀特湾")])
  })

  it("sends a contested term to the prompt once, not twice", () => {
    const merged = mergeGlossaryTerms([[entry("i:a", "1"), entry("i:b", "2")], [entry("i:a", "3")]])

    expect(merged.filter((e) => e.matchKey === "i:a")).toHaveLength(1)
    expect(merged).toHaveLength(2)
  })

  it("keeps both case modes of the same word, which are different terms", () => {
    const merged = mergeGlossaryTerms([
      [{ matchKey: "s:IT", source: "IT", target: "信息技术", caseSensitive: true }],
      [{ matchKey: "i:it", source: "it", target: "它", caseSensitive: false }],
    ])

    expect(merged).toHaveLength(2)
  })

  it("returns nothing for no glossaries and for empty ones", () => {
    expect(mergeGlossaryTerms([])).toEqual([])
    expect(mergeGlossaryTerms([[], []])).toEqual([])
  })
})
