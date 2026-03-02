// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { extractTextContext, getSelectionParagraphText } from "../utils"

describe("extractTextContext", () => {
  it("should extract context when selection is in the middle of a sentence", () => {
    const fullText = "This is a test sentence. Another sentence here."
    const selection = "test"

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: "This is a ",
      selection: "test",
      after: " sentence.",
    })
  })

  it("should handle selection that equals full text", () => {
    const fullText = " This is a test sentence. Another sentence here."
    const selection = " This is a test sentence. Another sentence here."

    const result = extractTextContext(fullText, selection)

    expect(result).toEqual({
      before: "",
      selection: " This is a test sentence. Another sentence here.",
      after: "",
    })
  })

  describe("edge cases", () => {
    it("should handle empty selection", () => {
      const fullText = "This is a test sentence."
      const selection = ""

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: "",
        selection: "",
        after: "",
      })
    })

    it("should handle empty full text", () => {
      const fullText = ""
      const selection = "test"

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: "",
        selection: "test",
        after: "",
      })
    })

    it("should handle both empty", () => {
      const fullText = ""
      const selection = ""

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: "",
        selection: "",
        after: "",
      })
    })

    it("should handle selection not found in text", () => {
      const fullText = "This is a test sentence."
      const selection = "notfound"

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: "",
        selection: "notfound",
        after: "",
      })
    })

    it("should handle selection with leading space when there is text before it", () => {
      const fullText = "The first sentence. This is a test sentence. Another sentence here."
      const selection = " This is a test sentence."

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: "",
        selection: " This is a test sentence.",
        after: "",
      })
    })

    it("should handle selection with leading space but without quotes", () => {
      const fullText = "The first sentence. This is a test sentence. Another sentence here."
      const selection = " This is a test sentence"

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: "",
        selection: " This is a test sentence",
        after: "",
      })
    })

    it("should handle selection that spans multiple sentences", () => {
      const fullText = "The first sentence. This is a test sentence. Another sentence here."
      const selection = "This is a test sentence. Another sentence here."

      const result = extractTextContext(fullText, selection)

      expect(result).toEqual({
        before: "",
        selection: "This is a test sentence. Another sentence here.",
        after: "",
      })
    })
  })
})

describe("getSelectionParagraphText", () => {
  it("returns normalized text from the nearest paragraph-like element", () => {
    document.body.innerHTML = `
      <article>
        <p id="paragraph">
          Alpha text
          <strong id="selection">Beta</strong>
          gamma text
        </p>
      </article>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    expect(getSelectionParagraphText(range)).toBe("Alpha text Beta gamma text")
  })

  it("falls back to common ancestor text when no paragraph-like parent exists", () => {
    document.body.innerHTML = `
      <span id="wrapper">
        <span>Alpha</span>
        <span id="selection">Beta</span>
      </span>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    expect(getSelectionParagraphText(range)).toBe("Alpha Beta")
  })
})
