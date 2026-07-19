import { describe, expect, it } from "vitest"
import { annotateText, collectRareWords, isRareWord } from "../annotate"
import { getWordRank } from "../word-rank"

describe("isRareWord", () => {
  it.each([
    ["the", 5000, false, "high-frequency word within threshold"],
    ["people", 5000, false, "high-frequency word within threshold"],
    ["people", 10, true, "listed word beyond a tiny threshold"],
    ["serendipity", 5000, true, "unlisted lowercase word"],
    ["of", 0, false, "short word always familiar"],
    ["NASA", 0, false, "acronym skipped"],
    ["Kowalski", 5000, false, "unlisted capitalized word (likely proper noun)"],
  ])("%s @ rank<=%i -> rare=%s (%s)", (word, rank, expected) => {
    expect(isRareWord(word, rank)).toBe(expected)
  })

  it("has no listed rank for words treated as unlisted-rare", () => {
    expect(getWordRank("serendipity")).toBeUndefined()
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
