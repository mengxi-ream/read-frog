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

/**
 * The other side of the whitespace problem: the run is in the STORED SOURCE.
 *
 * Nothing folds a term's interior spacing on the way in — the editor and CSV
 * import only trim — so a term pasted out of a wrapped page is stored as
 * `Chort  Bay` and looks perfectly ordinary in the list. Matching it was never
 * the problem: `termToPattern` compiles the run to `\s+`, so the pattern found
 * the page text fine. The hit was then looked up in an index keyed on the
 * unfolded source, found no bucket, and was dropped — the term sat there,
 * enabled, and silently never applied to anything.
 */
describe("terms stored with an interior whitespace run", () => {
  const sourcesFor = (entries: GlossaryEntry[], text: string) =>
    createGlossaryMatcher(entries)
      .match(text)
      .map((hit) => hit.source)

  it("matches the page's single space and the doubled text it was copied from", () => {
    const matcher = createGlossaryMatcher([entry("Chort  Bay", "雀特湾")])
    expect(matcher.size).toBe(1)
    // `source` comes back folded, which is the point: it is the string rendered
    // into the glossary block of the system prompt, and sending `Chort  Bay`
    // there would only teach the model the user's stray keystroke. `matchKey`
    // is deliberately untouched — it is the stored row's identity, and the
    // repository built it from the source as typed.
    const expected = {
      matchKey: "i:chort  bay",
      source: "Chort Bay",
      target: "雀特湾",
      keepOriginal: false,
    }
    expect(matcher.match("at Chort Bay now")).toEqual([expected])
    expect(matcher.match("at Chort  Bay now")).toEqual([expected])
  })

  // Every separator `\s` covers, since each one reaches the store the same way:
  // a tab or newline from copied source, a full-width space from CJK input.
  const STORED_RUNS: [label: string, source: string][] = [
    ["a tab", "Chort\tBay"],
    ["a newline", "Chort\nBay"],
    ["a full-width space", "Chort　Bay"],
    ["a mixed run", "Chort 　\n\tBay"],
  ]

  it("pins the separators those cases turn on, which no diff can show", () => {
    // A full-width space is written literally above, exactly as it arrives from
    // a CJK keyboard — and it is indistinguishable from an ASCII one on screen.
    // An editor that normalised it, or a rewrite of the escapes into literals,
    // would leave every case below reading the same and passing for the wrong
    // reason, so the bytes are asserted rather than trusted.
    // `Array.from` rather than a spread, which `no-misused-spread` refuses on a
    // string. Splitting by code point is what is wanted here anyway: every
    // separator below is one BMP character, so there is no pair to break.
    const separators = STORED_RUNS.map(([, source]) =>
      Array.from(source.slice("Chort".length, -"Bay".length), (char) => char.codePointAt(0)),
    )
    expect(separators).toEqual([[0x09], [0x0a], [0x3000], [0x20, 0x3000, 0x0a, 0x09]])
  })

  it.each(STORED_RUNS)("matches when the stored source holds %s", (_label, source) => {
    const entries = [entry(source, "雀特湾")]
    expect(sourcesFor(entries, "at Chort Bay now")).toEqual(["Chort Bay"])
    expect(sourcesFor(entries, `at ${source} now`)).toEqual(["Chort Bay"])
  })

  it("matches a case-sensitive term, and still refuses another casing", () => {
    // The half that a fix applied only to the index lookup would miss: the
    // case-sensitive branch compares the ENTRY'S OWN source against the folded
    // hit, so an unfolded source fails that comparison even once the bucket is
    // found — the term would stay just as dead, only later in the function.
    const entries = [entry("Chort  Bay", "雀特湾", true)]
    expect(sourcesFor(entries, "at Chort Bay now")).toEqual(["Chort Bay"])
    expect(sourcesFor(entries, "at Chort  Bay now")).toEqual(["Chort Bay"])
    expect(sourcesFor(entries, "at chort bay now")).toEqual([])
    expect(sourcesFor(entries, "at chort  bay now")).toEqual([])
  })

  it("leaves an entry that was already single-spaced exactly as it was", () => {
    const entries = [entry("Chort Bay", "雀特湾"), entry("Chort", "雀特")]
    const matcher = createGlossaryMatcher(entries)
    expect(matcher.size).toBe(2)
    expect(matcher.match("landed at Chort Bay")).toEqual([
      { matchKey: "i:chort bay", source: "Chort Bay", target: "雀特湾", keepOriginal: false },
    ])
    expect(sourcesFor(entries, "landed at Chort")).toEqual(["Chort"])
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

describe("a rejected candidate and the shorter terms starting at the same position", () => {
  const sourcesFor = (entries: GlossaryEntry[], text: string) =>
    createGlossaryMatcher(entries)
      .match(text)
      .map((hit) => hit.source)

  // The alternation yields exactly ONE candidate per position — the longest
  // branch that matched — because JavaScript's `|` is leftmost-FIRST. So when
  // that candidate is rejected afterwards, the shorter terms starting at the
  // same position have not been examined and found wanting; they were never
  // generated. Resuming one character later abandons them unseen.

  it("recovers the shorter term when the longer one fails its end boundary", () => {
    // No case-sensitivity anywhere: `Chort Bay` matches inside `bayonet` and is
    // then rejected for the `o` glued to its end.
    const entries = [entry("Chort Bay", "雀特湾"), entry("Chort", "雀特")]
    expect(sourcesFor(entries, "we landed at Chort bayonet factory")).toEqual(["Chort"])
    // The same two entries on text that rejects nothing — this is what makes the
    // bug so hard to self-diagnose: the term works, just not in every sentence.
    expect(sourcesFor(entries, "we landed at Chort today")).toEqual(["Chort"])
    expect(sourcesFor(entries, "we landed at Chort Bay today")).toEqual(["Chort Bay"])
  })

  it("recovers the shorter term when the longer one fails its case check", () => {
    const entries = [entry("Chort Bay", "雀特湾", true), entry("Chort", "雀特")]
    expect(sourcesFor(entries, "we landed at chort bay before dawn")).toEqual(["Chort"])
    expect(sourcesFor(entries, "we landed at Chort Bay before dawn")).toEqual(["Chort Bay"])
  })

  it("keeps retrying past more than one rejection", () => {
    const entries = [
      entry("Chort Bay Road", "雀特湾路", true),
      entry("Chort Bay", "雀特湾", true),
      entry("Chort", "雀特"),
    ]
    expect(sourcesFor(entries, "we walked chort bay road today")).toEqual(["Chort"])
  })

  it("takes the longest ACCEPTABLE term, not merely the first that survives", () => {
    const entries = [
      entry("Chort Bay Road", "雀特湾路", true),
      entry("Chort Bay", "雀特湾"),
      entry("Chort", "雀特"),
    ]
    expect(sourcesFor(entries, "we walked chort bay road today")).toEqual(["Chort Bay"])
  })

  it("still finds a term that starts INSIDE the rejected span", () => {
    // What the one-character resume was written for, and it still holds: `Bay`
    // begins six characters into the span `Chort Bay` was rejected on.
    const entries = [entry("Chort Bay", "雀特湾", true), entry("Bay", "湾")]
    expect(sourcesFor(entries, "we landed at chort bay now")).toEqual(["Bay"])
  })

  it("terminates when the rejected candidate is a single character", () => {
    // The retry window is `[start, end - 1)`, empty for a one-character hit.
    const entries = [entry("A", "甲", true)]
    expect(sourcesFor(entries, "a lowercase a only")).toEqual([])
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
