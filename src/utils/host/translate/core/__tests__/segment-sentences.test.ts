import { describe, expect, it } from "vitest"
import { segmentSentences } from "../segment-sentences"

describe("segmentSentences", () => {
  it("splits English text into sentences", () => {
    const result = segmentSentences("The cat sat on the mat. It was a dark night.")
    expect(result).toEqual([
      "The cat sat on the mat. ",
      "It was a dark night.",
    ])
  })

  it("preserves inter-sentence whitespace (trailing space on non-last segments)", () => {
    const result = segmentSentences("Hello. World. Test.")
    expect(result).toEqual([
      "Hello. ",
      "World. ",
      "Test.",
    ])
  })

  it("splits Chinese text into sentences", () => {
    const result = segmentSentences("猫坐在垫子上。那是一个漆黑的夜晚。")
    expect(result).toEqual([
      "猫坐在垫子上。",
      "那是一个漆黑的夜晚。",
    ])
  })

  it("handles question marks and exclamation marks", () => {
    const result = segmentSentences("Hello! How are you? I am fine.")
    expect(result).toEqual([
      "Hello! ",
      "How are you? ",
      "I am fine.",
    ])
  })

  it("returns single sentence as-is", () => {
    const result = segmentSentences("This is a single sentence.")
    expect(result).toEqual(["This is a single sentence."])
  })

  it("returns empty array for empty string", () => {
    expect(segmentSentences("")).toEqual([])
  })

  it("returns empty array for whitespace-only string", () => {
    expect(segmentSentences("   \n  \t  ")).toEqual([])
  })

  it("returns [text] when Intl.Segmenter is not available", () => {
    const originalIntl = globalThis.Intl
    // @ts-expect-error - intentionally removing Intl for test
    delete globalThis.Intl

    const result = segmentSentences("Hello world. Test.")
    expect(result).toEqual(["Hello world. Test."])

    globalThis.Intl = originalIntl
  })

  it("filters out empty segments (noise between sentences)", () => {
    // Intl.Segmenter may produce empty segments between sentences
    const result = segmentSentences("Hello. World.")
    expect(result.length).toBe(2)
    expect(result.every(s => s.length > 0)).toBe(true)
  })
})
