import { describe, expect, it } from "vitest"
import { isTextScript, segmentWords } from "../segment"

describe("segmentWords", () => {
  it("lists each word once, as written, in the order it first appears, with every place it is", () => {
    const { words, spans } = segmentWords("The cat saw the cat.")

    expect(words).toEqual(["The", "cat", "saw", "the"])
    expect(spans[1]).toEqual([
      { start: 4, end: 7 },
      { start: 16, end: 19 },
    ])
  })

  it("tells which words only ever begin a sentence", () => {
    const { words, starts } = segmentWords(
      "Apple pie is sweet. Apple tart too. I like Paris. Paris is far.",
    )

    const startWords = starts.map((index) => words[index])
    // "Paris" also appears mid-sentence, so its capital is its own.
    expect(startWords).toEqual(["Apple", "I"])
  })

  it("counts a word after an opening quote as the start of its sentence", () => {
    const { words, starts } = segmentWords("“Well,” she said.")

    expect(starts.map((index) => words[index])).toEqual(["Well"])
  })

  it("leaves out numbers and words longer than the contract takes", () => {
    const long = "a".repeat(65)
    const { words } = segmentWords(`In 2024 there were 3 ${long} words.`)

    expect(words).toEqual(["In", "there", "were", "words"])
  })

  it("keeps words with digits or apostrophes that have letters", () => {
    const { words } = segmentWords("Don't use mp3 files.")

    expect(words).toContain("Don't")
    expect(words).toContain("mp3")
  })

  it("stops adding words past the limit, still placing the ones it has", () => {
    const { words, spans } = segmentWords("one two three one four", 2)

    expect(words).toEqual(["one", "two"])
    expect(spans[0]).toHaveLength(2)
  })
})

describe("isTextScript", () => {
  it("is true for Chinese and Japanese", () => {
    expect(isTextScript("我们今天去公园散步。")).toBe(true)
    expect(isTextScript("今日はいい天気ですね。")).toBe(true)
  })

  it("is false for languages with spaces between words", () => {
    expect(isTextScript("The weather is nice today.")).toBe(false)
    expect(isTextScript("Сегодня хорошая погода.")).toBe(false)
  })

  it("weighs a character of those scripts as four letters", () => {
    expect(isTextScript("iPhone 16 Pro 发布会今天举行")).toBe(true)
    expect(isTextScript("在 package.json 中设置 dependencies 字段")).toBe(true)
    expect(isTextScript("The word 你好 means hello in Chinese")).toBe(false)
  })

  it("is false without letters", () => {
    expect(isTextScript("1234 — 5678")).toBe(false)
  })
})
