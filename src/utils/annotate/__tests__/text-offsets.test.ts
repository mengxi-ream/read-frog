// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import {
  findNearestOccurrence,
  getBlockText,
  isInsideTranslatedContent,
  offsetsToRange,
  rangeToOffsets,
} from "../text-offsets"

function paragraph(html: string) {
  const block = document.createElement("p")
  block.innerHTML = html
  document.body.append(block)
  return block
}

describe("block text", () => {
  it("is the page's own text, without furigana or the extension's own insertions", () => {
    const block = paragraph(
      `The <b>quick</b> <ruby>狐<rt>きつね</rt></ruby> fox<span class="${CONTENT_WRAPPER_CLASS}">狐狸</span>.`,
    )

    expect(getBlockText(block)).toBe("The quick 狐 fox.")
  })
})

describe("offsets and ranges", () => {
  it("round-trips a range through the offsets, across text nodes", () => {
    const block = paragraph("The <b>quick</b> brown <i>fox</i> jumps")
    const range = document.createRange()
    range.setStart(block.querySelector("b")!.firstChild!, 2)
    range.setEnd(block.querySelector("i")!.firstChild!, 2)

    const offsets = rangeToOffsets(block, range)
    expect(offsets).toEqual({ start: 6, end: 18 })
    expect(getBlockText(block).slice(6, 18)).toBe("ick brown fo")

    const rebuilt = offsetsToRange(block, 6, 18)!
    expect(rebuilt.toString()).toBe("ick brown fo")
    expect(rebuilt.startContainer).toBe(block.querySelector("b")!.firstChild)
    expect(rebuilt.endContainer).toBe(block.querySelector("i")!.firstChild)
  })

  it("takes an element boundary as the next text", () => {
    const block = paragraph("ab<b>cd</b>ef")
    const range = document.createRange()
    range.setStart(block, 1) // before <b>
    range.setEnd(block, 2) // after <b>

    expect(rangeToOffsets(block, range)).toEqual({ start: 2, end: 4 })
  })

  it("ignores the extension's own text when counting", () => {
    const block = paragraph(`ab<span class="${CONTENT_WRAPPER_CLASS}">译文</span>cd`)
    const range = document.createRange()
    range.setStart(block.lastChild!, 0)
    range.setEnd(block.lastChild!, 2)

    expect(rangeToOffsets(block, range)).toEqual({ start: 2, end: 4 })
    expect(offsetsToRange(block, 2, 4)!.toString()).toBe("cd")
  })

  it("refuses empty and out-of-range spans", () => {
    const block = paragraph("abc")
    expect(offsetsToRange(block, 2, 2)).toBeNull()
    expect(offsetsToRange(block, 0, 9)).toBeNull()
    const collapsed = document.createRange()
    collapsed.setStart(block.firstChild!, 1)
    collapsed.collapse(true)
    expect(rangeToOffsets(block, collapsed)).toBeNull()
  })
})

describe("findNearestOccurrence", () => {
  it("finds the occurrence closest to where the text was", () => {
    const text = "cat and cat and cat"
    expect(findNearestOccurrence(text, "cat", 9)).toBe(8)
    expect(findNearestOccurrence(text, "cat", 15)).toBe(16)
    expect(findNearestOccurrence(text, "cat", 0)).toBe(0)
    expect(findNearestOccurrence(text, "dog", 0)).toBeNull()
    expect(findNearestOccurrence(text, "", 0)).toBeNull()
  })
})

describe("isInsideTranslatedContent", () => {
  it("knows a translation the extension inserted from the page's own text", () => {
    const block = paragraph(`ab<span class="${CONTENT_WRAPPER_CLASS}">译文</span>`)
    expect(isInsideTranslatedContent(block.firstChild)).toBe(false)
    expect(isInsideTranslatedContent(block.lastChild!.firstChild)).toBe(true)
    expect(isInsideTranslatedContent(null)).toBe(false)
  })
})
