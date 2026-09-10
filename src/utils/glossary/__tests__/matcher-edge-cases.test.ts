import type { GlossaryEntry } from "../types"
import { describe, expect, it } from "vitest"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { buildMatchKey } from "../match-key"
import { createGlossaryMatcher } from "../matcher"

function entry(source: string, target = "X", caseSensitive = false): GlossaryEntry {
  return { matchKey: buildMatchKey(source, caseSensitive), source, target, caseSensitive }
}
const matches = (term: string, text: string, caseSensitive = false) =>
  createGlossaryMatcher([entry(term, "X", caseSensitive)]).match(text).length > 0

describe("multi-word terms across real page whitespace", () => {
  // A user types one space. The page holds whatever HTML and wrapping produced.
  it.each([
    ["one space", "at Chort Bay now"],
    ["two spaces", "at Chort  Bay now"],
    ["non-breaking space", "at Chort Bay now"],
    ["newline from wrapped source", "at Chort\nBay now"],
    ["tab", "at Chort\tBay now"],
    ["mixed run", "at Chort  \n Bay now"],
  ])("matches across %s", (_label, text) => {
    expect(matches("Chort Bay", text)).toBe(true)
  })

  it("still refuses the words run together", () => {
    expect(matches("Chort Bay", "at ChortBay now")).toBe(false)
  })

  it("ignores stray whitespace around a stored term", () => {
    // `buildMatchKey` trims, so the compiled pattern must trim too or the entry
    // is unreachable — its key says one thing and its pattern another.
    expect(matches("  Chort Bay  ", "at Chort Bay now")).toBe(true)
  })

  it("matches a CJK term written with a full-width space", () => {
    expect(matches("機械 学習", "これは機械　学習です")).toBe(true)
  })

  it("reports the term as the user typed it, not as the page spaced it", () => {
    const [hit] = createGlossaryMatcher([entry("Chort Bay", "雀特湾")]).match("at Chort \nBay now")
    expect(hit).toMatchObject({ source: "Chort Bay", target: "雀特湾" })
  })

  it("honours case sensitivity across a whitespace run", () => {
    expect(matches("Chort Bay", "at Chort  Bay", true)).toBe(true)
    expect(matches("Chort Bay", "at chort  bay", true)).toBe(false)
  })
})

describe("unicode normalisation", () => {
  const NFC = "café" // é as one code point
  const NFD = "café" // e + combining acute

  it("matches whichever form the page uses", () => {
    expect(matches(NFC, `a ${NFC} here`)).toBe(true)
    expect(matches(NFC, `a ${NFD} here`)).toBe(true)
    expect(matches(NFD, `a ${NFC} here`)).toBe(true)
    expect(matches(NFD, `a ${NFD} here`)).toBe(true)
  })
})

describe("case folding, including the traps", () => {
  it("folds Greek final sigma, which differs from the capital form", () => {
    expect(matches("ΟΔΟΣ", "η οδος εδω")).toBe(true)
    expect(matches("οδος", "η ΟΔΟΣ εδω")).toBe(true)
  })

  it("treats accents as meaningful rather than folding them away", () => {
    expect(matches("ΟΔΟΣ", "η οδός εδώ")).toBe(false)
  })

  it("does not apply locale-specific folds", () => {
    // Turkish dotted capital I only folds to `i` under a Turkish locale; doing it
    // globally would mis-match every other language, so it is left alone.
    expect(matches("istanbul", "İstanbul is big")).toBe(false)
    // Likewise ß/SS, which is a German-specific expansion.
    expect(matches("STRASSE", "die Straße")).toBe(false)
  })
})

describe("scripts and symbols", () => {
  it("matches around CJK punctuation", () => {
    expect(matches("机器学习", "这是「机器学习」啊")).toBe(true)
    expect(matches("机器学习", "机器学习、深度学习")).toBe(true)
  })

  it("matches terms outside the basic plane", () => {
    expect(matches("𠮷野家", "行く𠮷野家へ")).toBe(true)
    expect(matches("🍎pie", "a 🍎pie here")).toBe(true)
  })

  it("matches right-to-left scripts", () => {
    expect(matches("مرحبا", "قال مرحبا لي")).toBe(true)
  })

  it("keeps hyphens and digits significant", () => {
    expect(matches("e-mail", "send an e-mail now")).toBe(true)
    expect(matches("e-mail", "send an email now")).toBe(false)
    expect(matches("123", "code 123 here")).toBe(true)
    expect(matches("123", "code 1234 here")).toBe(false)
  })
})

describe("overlapping multi-word terms", () => {
  it("finds both halves of an overlap independently", () => {
    expect(matches("New York", "New York City rocks")).toBe(true)
    expect(matches("York City", "New York City rocks")).toBe(true)
  })

  it("prefers the longest term at a position when both are in one glossary", () => {
    const hits = createGlossaryMatcher([entry("New York"), entry("New York City")]).match(
      "New York City rocks",
    )
    expect(hits.map((hit) => hit.source)).toEqual(["New York City"])
  })
})

describe("string edges", () => {
  it.each([
    ["whole string", "Chort Bay"],
    ["followed by a full stop", "Chort Bay."],
    ["at the start", "Chort Bay is north"],
    ["at the end", "we reached Chort Bay"],
  ])("matches %s", (_label, text) => {
    expect(matches("Chort Bay", text)).toBe(true)
  })
})

describe("zero-width characters", () => {
  const ZWSP = "\u200B"
  // The matcher runs on text that has already been through the pipeline, so a
  // term must be stripped the same way or it can never match what it is scanned
  // against. Terms are routinely pasted from web pages, which are full of these.
  const throughPipeline = (term: string, raw: string) =>
    createGlossaryMatcher([entry(term)]).match(prepareTranslationText(raw)).length > 0

  it("matches when the TERM was pasted carrying one", () => {
    expect(throughPipeline(`Chort${ZWSP} Bay`, "at Chort Bay now")).toBe(true)
    expect(throughPipeline(`Chort${ZWSP}Bay`, "at ChortBay now")).toBe(true)
  })

  it("matches when the PAGE carries one", () => {
    expect(throughPipeline("Chort Bay", `at Chort${ZWSP} Bay now`)).toBe(true)
  })

  it("gives two visually identical terms the same identity", () => {
    // Otherwise the user gets two rows they cannot tell apart, and only one of
    // them ever matches.
    expect(buildMatchKey(`Chort${ZWSP} Bay`, false)).toBe(buildMatchKey("Chort Bay", false))
  })

  it("gives the two normalisation forms the same identity", () => {
    expect(buildMatchKey("caf\u00E9", false)).toBe(buildMatchKey("cafe\u0301", false))
  })
})

describe("scripts written without spaces beyond CJK", () => {
  it.each([
    ["Thai", "ภาษาไทย", "นี่คือภาษาไทยครับ"],
    ["Lao", "ພາສາລາວ", "ນີ້ແມ່ນພາສາລາວ"],
    ["Khmer", "ភាសាខ្មែរ", "នេះជាភាសាខ្មែរ"],
    ["Myanmar", "မြန်မာ", "ဤသည်မြန်မာဘာသာ"],
  ])("matches a %s term with no surrounding spaces", (_label, term, text) => {
    expect(matches(term, text)).toBe(true)
  })

  it("matches a Latin term embedded in Thai", () => {
    expect(matches("AI", "ผมใช้AIทำงาน")).toBe(true)
  })
})
