import { describe, expect, it } from "vitest"
import { isRareWord } from "../annotate"

describe("inflection-aware rarity via lemma candidates", () => {
  it("treats regular past-tense forms of common verbs as familiar", () => {
    // "walked" itself ranks beyond 5000, but "walk" is well within it.
    expect(isRareWord("walked", 5000)).toBe(false)
  })

  it("treats -ing forms of common verbs as familiar", () => {
    // "studying" itself ranks beyond 5000, but "study" is well within it.
    expect(isRareWord("studying", 5000)).toBe(false)
  })

  it("treats doubled-consonant -ing forms as familiar", () => {
    // "run" -> "running" doubles the final consonant.
    expect(isRareWord("running", 5000)).toBe(false)
  })

  it("treats plurals of common nouns as familiar", () => {
    expect(isRareWord("cities", 5000)).toBe(false)
    expect(isRareWord("boxes", 5000)).toBe(false)
  })

  it("still treats genuinely rare words as rare regardless of inflection", () => {
    expect(isRareWord("serendipities", 5000)).toBe(true)
  })
})
