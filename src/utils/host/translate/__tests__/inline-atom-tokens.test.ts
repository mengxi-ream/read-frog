import { describe, expect, it } from "vitest"
import {
  auditInlineAtomTokens,
  decodeInlineAtomTokens,
  encodeInlineAtomToken,
  hasInlineAtomTokens,
  INLINE_ATOM_TOKEN_DELIMITERS,
  INLINE_ATOM_TOKEN_SYSTEM_PROMPT,
  nextFreeInlineAtomIndex,
} from "../inline-atom-tokens"

const { open, close } = INLINE_ATOM_TOKEN_DELIMITERS

describe("encodeInlineAtomToken", () => {
  it("emits the delimiter constant around the index", () => {
    expect(encodeInlineAtomToken(0)).toBe(`${open}0${close}`)
    expect(encodeInlineAtomToken(12)).toBe(`${open}12${close}`)
  })
})

describe("hasInlineAtomTokens", () => {
  it("detects only the emitted shape", () => {
    expect(hasInlineAtomTokens(`Let ${encodeInlineAtomToken(0)} be the mean.`)).toBe(true)
    expect(hasInlineAtomTokens(encodeInlineAtomToken(3))).toBe(true)
  })

  it.each([
    ["plain text", "Hello world"],
    ["the no-translation sentinel", "{{NO_TRANSLATION_NEEDED}}"],
    ["a named prompt token", "Translate {{input}} now"],
    ["a spaced literal", "{{ 0 }}"],
    ["a single-brace literal", "{0}"],
    ["a citation", "as shown in [26]"],
  ])("ignores %s", (_case, text) => {
    expect(hasInlineAtomTokens(text)).toBe(false)
  })
})

describe("nextFreeInlineAtomIndex", () => {
  it("starts at zero for prose without token-shaped literals", () => {
    expect(nextFreeInlineAtomIndex("")).toBe(0)
    expect(nextFreeInlineAtomIndex("no tokens here")).toBe(0)
  })

  it("skips past the highest literal already in the prose", () => {
    expect(nextFreeInlineAtomIndex("see {{3}} and {{1}}")).toBe(4)
    expect(nextFreeInlineAtomIndex("{{0}}")).toBe(1)
  })
})

describe("decodeInlineAtomTokens", () => {
  it("splits text runs and tokens in order", () => {
    expect(decodeInlineAtomTokens("设 {{0}} 为 {{1}}。")).toEqual([
      { kind: "text", text: "设 " },
      { kind: "atom", index: 0, raw: "{{0}}" },
      { kind: "text", text: " 为 " },
      { kind: "atom", index: 1, raw: "{{1}}" },
      { kind: "text", text: "。" },
    ])
  })

  it("returns a single text part when there are no tokens", () => {
    expect(decodeInlineAtomTokens("nothing here")).toEqual([{ kind: "text", text: "nothing here" }])
    expect(decodeInlineAtomTokens("")).toEqual([])
  })

  it("keeps reordered tokens in translation order", () => {
    const indexes = decodeInlineAtomTokens("{{1}} before {{0}}")
      .filter((part) => part.kind === "atom")
      .map((part) => part.index)
    expect(indexes).toEqual([1, 0])
  })

  // Only the emitted shape decodes. Anything else is page content: a decoder
  // wider than `nextFreeInlineAtomIndex`'s numbering scan would render a
  // formula over one of these literals and drop the real token as a duplicate.
  it.each([
    ["inner whitespace", "{{ 2 }}"],
    ["fullwidth braces", "｛｛2｝｝"],
    ["fullwidth digits", "{{２}}"],
    ["mathematical white brackets", "⟦2⟧"],
    ["double square brackets", "[[2]]"],
    ["CJK lenticular brackets", "〖2〗"],
    ["bare citation", "[26]"],
    ["single braces", "{7}"],
  ])("keeps %s as literal text", (_case, raw) => {
    expect(decodeInlineAtomTokens(`x ${raw} y`)).toEqual([{ kind: "text", text: `x ${raw} y` }])
  })

  it("does not let a token-shaped literal in the prose swallow the real token", () => {
    // The page wrote `[[0]]`; `{{0}}` is ours. Both survive, each as itself.
    expect(decodeInlineAtomTokens("Reshape to [[0]] before applying {{0}}.")).toEqual([
      { kind: "text", text: "Reshape to [[0]] before applying " },
      { kind: "atom", index: 0, raw: "{{0}}" },
      { kind: "text", text: "." },
    ])
  })
})

describe("auditInlineAtomTokens", () => {
  const source = "Let {{0}} be {{1}} and {{2}}."

  it("passes when every token comes back exactly once, in any order", () => {
    expect(auditInlineAtomTokens(source, "设 {{2}} 与 {{0}} 为 {{1}}。")).toEqual({
      ok: true,
      missing: [],
      unknown: [],
      duplicates: [],
    })
  })

  it("passes for a request without tokens", () => {
    expect(auditInlineAtomTokens("plain", "纯文本").ok).toBe(true)
  })

  it("reports missing, unknown and duplicated tokens", () => {
    expect(auditInlineAtomTokens(source, "设 {{0}} 为 {{0}}，{{7}}")).toEqual({
      ok: false,
      missing: [1, 2],
      unknown: [7],
      duplicates: [0],
    })
  })

  it("refuses a response that reformatted the placeholders", () => {
    // Never observed in the live probe, but if it happens the result is a
    // degraded render that must not reach the cache.
    expect(auditInlineAtomTokens(source, "｛｛０｝｝ ⟦1⟧ {{ 2 }}")).toEqual({
      ok: false,
      missing: [0, 1, 2],
      unknown: [],
      duplicates: [],
    })
  })
})

describe("INLINE_ATOM_TOKEN_SYSTEM_PROMPT", () => {
  it("names both delimiters and carries no worked example", () => {
    expect(INLINE_ATOM_TOKEN_SYSTEM_PROMPT).toContain(`\`${open}\``)
    expect(INLINE_ATOM_TOKEN_SYSTEM_PROMPT).toContain(`\`${close}\``)
    expect(INLINE_ATOM_TOKEN_SYSTEM_PROMPT).not.toMatch(/\{\{\d+\}\}/)
  })
})
