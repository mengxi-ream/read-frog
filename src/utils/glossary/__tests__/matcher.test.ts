import type { GlossaryEntry } from "../types"
import { describe, expect, it } from "vitest"
import { buildMatchKey } from "../match-key"
import { createGlossaryMatcher } from "../matcher"

function entry(source: string, target = "", caseSensitive = false): GlossaryEntry {
  return { matchKey: buildMatchKey(source, caseSensitive), source, target, caseSensitive }
}

function sourcesMatched(entries: GlossaryEntry[], text: string): string[] {
  return createGlossaryMatcher(entries)
    .match(text)
    .map((hit) => hit.source)
}

describe("createGlossaryMatcher", () => {
  it("matches a term and carries its target", () => {
    const hits = createGlossaryMatcher([entry("Chort Bay", "雀特湾")]).match(
      "We landed at Chort Bay before dawn.",
    )
    expect(hits).toEqual([
      { matchKey: "i:chort bay", source: "Chort Bay", target: "雀特湾", keepOriginal: false },
    ])
  })

  it("treats an empty target as keep-original", () => {
    const [hit] = createGlossaryMatcher([entry("NeonRider_07")]).match("thanks NeonRider_07 !")
    expect(hit).toMatchObject({ source: "NeonRider_07", target: "", keepOriginal: true })
  })

  it("returns nothing for an empty glossary or empty text", () => {
    expect(createGlossaryMatcher([]).match("anything")).toEqual([])
    expect(createGlossaryMatcher([entry("a")]).match("")).toEqual([])
  })

  it("ignores entries whose source is blank", () => {
    const matcher = createGlossaryMatcher([entry("   "), entry("token", "令牌")])
    expect(matcher.size).toBe(1)
    expect(matcher.match("a token here")).toHaveLength(1)
  })

  describe("word boundaries", () => {
    it("does not match inside a longer word", () => {
      expect(sourcesMatched([entry("token", "令牌")], "a tokenizer config")).toEqual([])
      expect(sourcesMatched([entry("AI", "人工智能")], "the RAID array failed")).toEqual([])
    })

    it("does not match inside accented Latin, where \\b would wrongly succeed", () => {
      // /\bcaf\b/.test("café") is true because é is not ASCII \w.
      expect(sourcesMatched([entry("caf", "咖啡")], "we sat in a café")).toEqual([])
    })

    it("matches CJK terms with no surrounding spaces, where \\b always fails", () => {
      // /\b机器学习\b/u.test("这是机器学习的东西") is false.
      expect(sourcesMatched([entry("机器学习", "machine learning")], "这是机器学习的东西")).toEqual(
        ["机器学习"],
      )
      expect(sourcesMatched([entry("서울", "Seoul")], "서울은 크다")).toEqual(["서울"])
    })

    it("matches a Latin term surrounded by CJK", () => {
      expect(sourcesMatched([entry("AI", "人工智能")], "我用AI工作")).toEqual(["AI"])
    })

    it("matches terms whose own edges are punctuation", () => {
      expect(sourcesMatched([entry("C++", "C加加")], "I write C++ daily")).toEqual(["C++"])
      expect(sourcesMatched([entry("GPU", "显卡")], "GPU/CPU load")).toEqual(["GPU"])
      expect(sourcesMatched([entry(".NET", "点网")], "built on .NET today")).toEqual([".NET"])
    })

    it("does not let a rejected match hide a shorter term starting inside it", () => {
      // "ken" is inside "tokenizer"; rejecting the "token" hit must not skip past it.
      expect(sourcesMatched([entry("token"), entry("ken")], "tokenizer")).toEqual([])
      expect(sourcesMatched([entry("token"), entry("izer")], "token izer")).toEqual([
        "izer",
        "token",
      ])
    })
  })

  describe("case sensitivity", () => {
    it("matches case-insensitively by default", () => {
      expect(sourcesMatched([entry("react", "React")], "I use REACT and React")).toEqual(["react"])
    })

    it("honours a case-sensitive entry", () => {
      const go = [entry("Go", "Go 语言", true)]
      expect(sourcesMatched(go, "I write Go daily")).toEqual(["Go"])
      expect(sourcesMatched(go, "I want to go home")).toEqual([])
    })

    it("lets a case-sensitive and a case-insensitive entry for the same word coexist", () => {
      const entries = [entry("Go", "Go 语言", true), entry("go", "去")]
      expect(createGlossaryMatcher(entries).size).toBe(2)
      // The case-sensitive entry is the more specific claim on "Go".
      expect(sourcesMatched(entries, "I write Go daily")).toEqual(["Go"])
      expect(sourcesMatched(entries, "I want to go home")).toEqual(["go"])
    })
  })

  describe("overlap and duplication", () => {
    it("prefers the longest term at a position", () => {
      const entries = [entry("Chort", "雀特"), entry("Chort Bay", "雀特湾")]
      expect(sourcesMatched(entries, "landed at Chort Bay")).toEqual(["Chort Bay"])
    })

    it("reports a term once however often it occurs", () => {
      const hits = createGlossaryMatcher([entry("Helldiver", "地狱潜兵")]).match(
        "A Helldiver met another Helldiver, then a third Helldiver.",
      )
      expect(hits).toHaveLength(1)
    })

    it("orders results by identity, not by position in the text", () => {
      const entries = [entry("zebra", "斑马"), entry("apple", "苹果")]
      const forwards = sourcesMatched(entries, "zebra then apple")
      const backwards = sourcesMatched(entries, "apple then zebra")
      expect(forwards).toEqual(backwards)
      expect(forwards).toEqual(["apple", "zebra"])
    })
  })

  it("treats regex metacharacters in a term as literal text", () => {
    const entries = [entry("a.b", "AB"), entry("c*d", "CD")]
    expect(sourcesMatched(entries, "value a.b and c*d")).toEqual(["a.b", "c*d"])
    expect(sourcesMatched(entries, "value axb")).toEqual([])
  })

  it("scans a realistic page against many terms without pathological cost", () => {
    const entries = Array.from({ length: 2000 }, (_, i) => entry(`Term${i}`, `译${i}`))
    entries.push(entry("Chort Bay", "雀特湾"))
    const page = "The Helldivers regrouped near the ridge. ".repeat(500) + "We reached Chort Bay."
    const matcher = createGlossaryMatcher(entries)
    const started = performance.now()
    const hits = matcher.match(page)
    expect(hits.map((hit) => hit.source)).toEqual(["Chort Bay"])
    expect(performance.now() - started).toBeLessThan(250)
  })
})

describe("buildMatchKey", () => {
  it("folds case only for case-insensitive entries", () => {
    expect(buildMatchKey("Chort Bay", false)).toBe("i:chort bay")
    expect(buildMatchKey("Chort Bay", true)).toBe("s:Chort Bay")
  })

  it("gives the same key to entries differing only in surrounding space and case", () => {
    expect(buildMatchKey("  React ", false)).toBe(buildMatchKey("react", false))
  })

  it("keeps a case-sensitive and a case-insensitive entry distinct", () => {
    expect(buildMatchKey("Go", true)).not.toBe(buildMatchKey("Go", false))
  })
})
