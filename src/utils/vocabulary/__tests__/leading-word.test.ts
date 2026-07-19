import { describe, expect, it } from "vitest"
import { getLeadingWord } from "../leading-word"

describe("getLeadingWord", () => {
  it.each([
    ["serendipity of their meeting", "serendipity"],
    ["Quixotic,", "quixotic"],
    ["   ", null],
    [null, null],
    [undefined, null],
  ])("%s -> %s", (input, expected) => {
    expect(getLeadingWord(input)).toBe(expected)
  })
})
