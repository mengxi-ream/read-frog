// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import {
  buildContextSnapshot,
  createRangeSnapshot,
  readSelectionSnapshot,
  truncateContextTextForCustomAction,
} from "../utils"

function createSelectionSnapshot(range: Range, text = range.toString()) {
  return {
    text,
    ranges: [
      createRangeSnapshot({
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      }),
    ],
  }
}

describe("buildContextSnapshot", () => {
  it("returns the nearest paragraph-like element text for selections spanning inline DOM nodes", () => {
    document.body.innerHTML = `
      <article>
        <p id="paragraph">
          Alpha text
          <strong id="selection-start">Beta</strong>
          gamma
          <em id="selection-end">delta</em>
          text
        </p>
      </article>
    `

    const startNode = document.getElementById("selection-start")?.firstChild
    const endNode = document.getElementById("selection-end")?.firstChild
    if (!startNode || !endNode) {
      throw new Error("Selection nodes not found")
    }

    const range = document.createRange()
    range.setStart(startNode, 0)
    range.setEnd(endNode, endNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha text Beta gamma delta text",
      paragraphs: ["Alpha text Beta gamma delta text"],
    })
  })

  it("joins intersected paragraphs in document order when the selection crosses multiple paragraphs", () => {
    document.body.innerHTML = `
      <article>
        <p id="first">Alpha <strong id="start">Beta</strong> gamma.</p>
        <p id="second">Delta <em id="end">epsilon</em> zeta.</p>
      </article>
    `

    const startNode = document.getElementById("start")?.firstChild
    const endNode = document.getElementById("end")?.firstChild
    if (!startNode || !endNode) {
      throw new Error("Selection nodes not found")
    }

    const range = document.createRange()
    range.setStart(startNode, 0)
    range.setEnd(endNode, endNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha Beta gamma.\n\nDelta epsilon zeta.",
      paragraphs: ["Alpha Beta gamma.", "Delta epsilon zeta."],
    })
  })

  it("uses generic block ancestors before falling back to broad semantic containers", () => {
    document.body.innerHTML = `
      <article id="article">
        <div id="block">
          Alpha
          <span id="selection">Beta</span>
          gamma
        </div>
      </article>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha Beta gamma",
      paragraphs: ["Alpha Beta gamma"],
    })
  })

  it("falls back to semantic containers only when no smaller paragraph-like block exists", () => {
    document.body.innerHTML = `
      <article id="article">
        Alpha
        <span id="selection">Beta</span>
        gamma
      </article>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha Beta gamma",
      paragraphs: ["Alpha Beta gamma"],
    })
  })
})

describe("readSelectionSnapshot", () => {
  it("returns the selected text and captured ranges", () => {
    document.body.innerHTML = `
      <div id="editable" contenteditable="true">
        Alpha <span id="selection">Beta</span> gamma
      </div>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    const selection = {
      toString: () => "Beta",
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection

    expect(readSelectionSnapshot(selection)).toMatchObject({
      text: "Beta",
      ranges: [expect.objectContaining({
        startContainer: selectionNode,
        startOffset: 0,
        endContainer: selectionNode,
        endOffset: 4,
      })],
    })
  })

  it("does not include unrelated shadow roots for light DOM selections", () => {
    document.body.innerHTML = `<div id="selection">Beta</div>`

    const unrelatedHost = document.createElement("div")
    unrelatedHost.attachShadow({ mode: "open" })
    document.body.appendChild(unrelatedHost)

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    const getComposedRanges = vi.fn(() => [range])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectionNode,
      focusNode: selectionNode,
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges,
    } as unknown as Selection

    readSelectionSnapshot(selection)

    expect(getComposedRanges).toHaveBeenCalledWith({
      shadowRoots: [],
    })
  })

  it("passes only the selected open shadow root to getComposedRanges", () => {
    document.body.innerHTML = ""

    const selectedHost = document.createElement("div")
    const selectedShadowRoot = selectedHost.attachShadow({ mode: "open" })
    const selectedText = document.createTextNode("Beta")
    selectedShadowRoot.append(selectedText)
    document.body.appendChild(selectedHost)

    const unrelatedHost = document.createElement("div")
    unrelatedHost.attachShadow({ mode: "open" })
    document.body.appendChild(unrelatedHost)

    const range = document.createRange()
    range.setStart(selectedText, 0)
    range.setEnd(selectedText, selectedText.textContent?.length ?? 0)

    const getComposedRanges = vi.fn(() => [range])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectedText,
      focusNode: selectedText,
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges,
    } as unknown as Selection

    readSelectionSnapshot(selection)

    expect(getComposedRanges).toHaveBeenCalledWith({
      shadowRoots: [selectedShadowRoot],
    })
  })

  it("passes nested open shadow root ancestors to getComposedRanges", () => {
    document.body.innerHTML = ""

    const outerHost = document.createElement("div")
    const outerShadowRoot = outerHost.attachShadow({ mode: "open" })
    document.body.appendChild(outerHost)

    const innerHost = document.createElement("div")
    const innerShadowRoot = innerHost.attachShadow({ mode: "open" })
    outerShadowRoot.appendChild(innerHost)

    const selectedText = document.createTextNode("Beta")
    innerShadowRoot.append(selectedText)

    const unrelatedHost = document.createElement("div")
    unrelatedHost.attachShadow({ mode: "open" })
    document.body.appendChild(unrelatedHost)

    const range = document.createRange()
    range.setStart(selectedText, 0)
    range.setEnd(selectedText, selectedText.textContent?.length ?? 0)

    const getComposedRanges = vi.fn(() => [range])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectedText,
      focusNode: selectedText,
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges,
    } as unknown as Selection

    readSelectionSnapshot(selection)

    expect(getComposedRanges).toHaveBeenCalledWith({
      shadowRoots: [innerShadowRoot, outerShadowRoot],
    })
  })

  it("falls back to getRangeAt when getComposedRanges returns no ranges", () => {
    document.body.innerHTML = `<div id="selection">Beta</div>`

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    const getRangeAt = vi.fn(() => range)
    const getComposedRanges = vi.fn(() => [])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectionNode,
      focusNode: selectionNode,
      rangeCount: 1,
      getRangeAt,
      getComposedRanges,
    } as unknown as Selection

    expect(readSelectionSnapshot(selection)).toMatchObject({
      text: "Beta",
      ranges: [expect.objectContaining({
        startContainer: selectionNode,
        startOffset: 0,
        endContainer: selectionNode,
        endOffset: 4,
      })],
    })
    expect(getRangeAt).toHaveBeenCalledWith(0)
  })
})

describe("truncateContextTextForCustomAction", () => {
  it("keeps only the leading characters for custom action context tokens", () => {
    expect(truncateContextTextForCustomAction("abcdefghij", 4)).toBe("abcd")
  })
})
