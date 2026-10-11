import { describe, expect, it } from "vitest"
import { segmentWords } from "../segment-words"

function words(text: string, locale?: string) {
  return segmentWords(text, locale)
    .filter((token) => token.isWord)
    .map((token) => token.text)
}

describe("segmentWords", () => {
  it("returns no tokens for an empty line", () => {
    expect(segmentWords("")).toEqual([])
  })

  it("keeps punctuation and spaces as non-word tokens so the line renders unchanged", () => {
    const tokens = segmentWords("I'm running out of patience.", "en")

    expect(tokens.map((token) => token.text).join("")).toBe("I'm running out of patience.")
    expect(words("I'm running out of patience.", "en")).toEqual([
      "I'm",
      "running",
      "out",
      "of",
      "patience",
    ])
  })

  it("splits Chinese into multi-character words rather than single characters", () => {
    const result = words("我们今天下午去图书馆复习吧。", "zh")

    expect(result.join("")).toBe("我们今天下午去图书馆复习吧")
    expect(result).toContain("我们")
    expect(result).toContain("今天")
    expect(result).toContain("下午")
    expect(result).toContain("复习")
  })

  it("splits Japanese into words", () => {
    const result = words("明日は雨が降るかもしれない。", "ja")

    expect(result).toContain("明日")
    expect(result).toContain("雨")
    expect(result.join("")).toBe("明日は雨が降るかもしれない")
  })

  it("still segments CJK text when the locale is unknown", () => {
    const result = words("我们今天去图书馆")

    expect(result.join("")).toBe("我们今天去图书馆")
    expect(result).toContain("我们")
    expect(result).toContain("今天")
  })
})

describe("segmentWords with the ISO 639-3 codes the subtitles track reports", () => {
  it("accepts three-letter language tags", () => {
    expect(words("Good morning everyone", "eng")).toEqual(["Good", "morning", "everyone"])
    expect(words("我们今天去图书馆", "cmn").join("")).toBe("我们今天去图书馆")
    expect(words("明日は雨", "jpn").join("")).toBe("明日は雨")
  })

  it("falls back to the default segmenter for a tag ICU rejects", () => {
    expect(words("Good morning", "not a locale")).toEqual(["Good", "morning"])
  })
})
