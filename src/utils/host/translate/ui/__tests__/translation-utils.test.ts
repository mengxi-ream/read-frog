import { describe, expect, it } from "vitest"
import { isShortInlineTranslationText } from "../translation-utils"

describe("isShortInlineTranslationText", () => {
  it.each([
    ["Introduction", true],
    ["one two three four", true],
    ["a".repeat(24), true],
    ["短标签", true],
    ["a".repeat(25), false],
    ["one two three four five", false],
    ["Introduction\nTitle", false],
    ["Introduction\rTitle", false],
    ["", false],
    ["   ", false],
  ])("classifies %j as %s", (text, expected) => {
    expect(isShortInlineTranslationText(text)).toBe(expected)
  })

  it("normalizes surrounding and repeated horizontal whitespace", () => {
    expect(isShortInlineTranslationText("  one\t two   three four  ")).toBe(true)
  })
})
