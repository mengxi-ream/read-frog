import { describe, expect, it } from "vitest"
import { isRareWord } from "../annotate"

describe("inflection-aware rarity via lemma candidates", () => {
  // Each inflected form itself ranks beyond 5000, but its lemma is well within
  // it, so isRareWord must fall back to the lemma candidate's rank.
  it.each([
    ["walked", "regular past tense"],
    ["studying", "-ing form"],
    ["running", "doubled-consonant -ing form"],
    ["cities", "-ies plural"],
    ["boxes", "-es plural"],
  ])("treats %s (%s) of a common word as familiar", (word) => {
    expect(isRareWord(word, 5000)).toBe(false)
  })

  it("still treats a genuinely rare word's inflection as rare", () => {
    expect(isRareWord("serendipities", 5000)).toBe(true)
  })
})
