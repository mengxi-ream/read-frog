import { describe, expect, it } from "vitest"
import { normalizeForComparison, prepareTranslationText } from "../text-preparation"

const NBSP = " "
const ZWSP = "​"
const BOM = "﻿"

describe("prepareTranslationText", () => {
  it("strips zero-width characters and trims", () => {
    expect(prepareTranslationText(`${ZWSP} hello ${BOM}`)).toBe("hello")
  })

  it("returns empty string for nullish input", () => {
    expect(prepareTranslationText(null)).toBe("")
    expect(prepareTranslationText(undefined)).toBe("")
  })
})

describe("normalizeForComparison", () => {
  it("treats NBSP as a regular space", () => {
    expect(normalizeForComparison(`It is${NBSP}a${NBSP}test`)).toBe(
      normalizeForComparison("It is a test"),
    )
  })

  it("collapses whitespace reflow (newlines, tabs, runs of spaces)", () => {
    expect(normalizeForComparison("a\n  b\tc")).toBe(normalizeForComparison("a b c"))
  })

  it("folds smart quotes to straight quotes", () => {
    expect(normalizeForComparison("It’s a “test”")).toBe(normalizeForComparison(`It's a "test"`))
    expect(normalizeForComparison("‚low‘ „high‟")).toBe(normalizeForComparison(`'low' "high"`))
  })

  it("folds the ellipsis character to three dots", () => {
    expect(normalizeForComparison("wait…")).toBe(normalizeForComparison("wait..."))
  })

  it("ignores case differences", () => {
    expect(normalizeForComparison("Hello World")).toBe(normalizeForComparison("hello world"))
  })

  it("folds fullwidth punctuation (NFKC)", () => {
    expect(normalizeForComparison("你好！")).toBe(normalizeForComparison("你好!"))
    expect(normalizeForComparison("２０２６")).toBe(normalizeForComparison("2026"))
  })

  it("treats a fully drifted echo as equal to its source", () => {
    const source = `It's a "test" that runs on Monday… REALLY`
    const echo = `It’s${NBSP}a${NBSP}“test” that runs on Monday... really`
    expect(normalizeForComparison(source)).toBe(normalizeForComparison(echo))
  })

  // https://github.com/mengxi-ream/read-frog/issues/2382
  it("ignores spaces between CJK and Latin letters or digits", () => {
    expect(normalizeForComparison("不管你是 GPT、Claude、Gemini，还是其他大模型")).toBe(
      normalizeForComparison("不管你是GPT、Claude、Gemini，还是其他大模型"),
    )
    expect(normalizeForComparison("Linus 当年写出 Linux，可没用 Claude。")).toBe(
      normalizeForComparison("Linus 当年写出Linux，可没用Claude。"),
    )
    expect(normalizeForComparison("2026 年发布")).toBe(normalizeForComparison("2026年发布"))
    expect(normalizeForComparison("Gemini の新機能")).toBe(normalizeForComparison("Geminiの新機能"))
  })

  it("keeps the spaces between Latin words", () => {
    expect(normalizeForComparison("用 Claude Code 写")).not.toBe(
      normalizeForComparison("用ClaudeCode写"),
    )
  })

  it("keeps genuinely different strings different", () => {
    expect(normalizeForComparison("hello world")).not.toBe(normalizeForComparison("你好世界"))
    expect(normalizeForComparison("first sentence")).not.toBe(
      normalizeForComparison("second sentence"),
    )
  })
})
