import { describe, expect, it } from "vitest"
import { annotateText, collectRareWords, isRareWord } from "../annotate"
import { getWordRank } from "../word-rank"

describe("isRareWord", () => {
  it("treats high-frequency words as familiar", () => {
    expect(isRareWord("the", 5000)).toBe(false)
    expect(isRareWord("people", 5000)).toBe(false)
  })

  it("treats words beyond the rank threshold as rare", () => {
    // Any listed word with rank > 10 is rare under a tiny threshold.
    expect(isRareWord("people", 10)).toBe(true)
  })

  it("treats unlisted lowercase words as rare", () => {
    expect(getWordRank("serendipity")).toBeUndefined()
    expect(isRareWord("serendipity", 5000)).toBe(true)
  })

  it("skips short words, acronyms and unlisted capitalized words", () => {
    expect(isRareWord("of", 0)).toBe(false)
    expect(isRareWord("NASA", 0)).toBe(false)
    expect(isRareWord("Kowalski", 5000)).toBe(false)
  })
})

describe("collectRareWords", () => {
  it("collects unique normalized rare words in first-seen order", () => {
    const words = collectRareWords(
      ["A serendipity moment.", "Pure serendipity, some quixotic plan."],
      5000,
      new Set(),
    )
    expect(words).toEqual(["serendipity", "quixotic"])
  })

  it("excludes known words", () => {
    const words = collectRareWords(["A serendipity moment."], 5000, new Set(["serendipity"]))
    expect(words).toEqual([])
  })
})

describe("annotateText", () => {
  it("annotates only the first occurrence across a run", () => {
    const glosses = new Map([["serendipity", "机缘巧合"]])
    const annotated = new Set<string>()
    expect(annotateText("Serendipity is serendipity.", glosses, annotated)).toBe(
      "Serendipity(机缘巧合) is serendipity.",
    )
    // A later text node in the same run must not annotate the word again.
    expect(annotateText("More serendipity here.", glosses, annotated)).toBe(
      "More serendipity here.",
    )
  })

  it("leaves words without glosses untouched", () => {
    expect(annotateText("Nothing rare here.", new Map(), new Set())).toBe("Nothing rare here.")
  })
})
