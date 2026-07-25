import { describe, expect, it } from "vitest"
import { findCandidateWords, normalizeWord } from "../candidates"

describe("vocabulary hunter candidates", () => {
  it("normalizes case and apostrophes", () => {
    expect(normalizeWord("LEARNER’S")).toBe("learner's")
  })

  it("keeps harder words and filters common or known words", () => {
    const result = findCandidateWords(
      "This comprehensive tutorial explains unfamiliar terminology.",
      7,
      { tutorial: "known" },
    )

    expect(result.map(({ word }) => word)).toEqual([
      "comprehensive",
      "explains",
      "unfamiliar",
      "terminology",
    ])
  })
})
