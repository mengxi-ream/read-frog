// @vitest-environment jsdom
// Node-identity restore for translationOnly mode (#1846): originals displaced by
// a translation wrapper are retained as ChildNode objects and re-inserted on
// restore — never rebuilt from an ancestor innerHTML snapshot.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "../../../dom/batch-dom"
import {
  removeAllTranslatedWrapperNodes,
  removeTranslatedWrapperWithRestore,
} from "../../dom/translation-cleanup"
import { translateNodeTranslationOnlyMode } from "../translation-modes"

const { mockShouldFilterSmallParagraph, mockTranslateTextForPage, mockShouldSkipAsTargetLanguage } =
  vi.hoisted(() => ({
    mockShouldFilterSmallParagraph: vi.fn<(...args: any[]) => any>(),
    mockTranslateTextForPage: vi.fn<(...args: any[]) => any>(),
    mockShouldSkipAsTargetLanguage: vi.fn<(...args: any[]) => any>(),
  }))

vi.mock("@/utils/host/translate/filter-small-paragraph", () => ({
  shouldFilterSmallParagraph: mockShouldFilterSmallParagraph,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mockTranslateTextForPage,
}))

vi.mock("@/utils/host/translate/target-language-skip", () => ({
  shouldSkipAsTargetLanguage: mockShouldSkipAsTargetLanguage,
}))

function getWrappers(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`.${CONTENT_WRAPPER_CLASS}`)]
}

describe("translationOnly node-identity restore (#1846)", () => {
  beforeEach(() => {
    document.body.replaceChildren()
    mockShouldFilterSmallParagraph.mockReset().mockResolvedValue(false)
    mockShouldSkipAsTargetLanguage.mockReset().mockResolvedValue(false)
    mockTranslateTextForPage.mockReset().mockResolvedValue("中文译文")
  })

  it("restores every original node when units were translated inner-first (issue repro)", async () => {
    // Mimics the NexusMods description: loose text plus a nested list under one
    // container, translated as separate units in inner-first order. The old
    // snapshot mechanism skipped saving the container (a wrapper already
    // existed inside it) and lost the loose text forever.
    const container = document.createElement("div")
    const introText = document.createTextNode("Intro paragraph text. ")
    const ul = document.createElement("ul")
    const li = document.createElement("li")
    const bold = document.createElement("b")
    bold.textContent = "Keep any of them"
    li.append(bold, document.createTextNode(" by setting its key to false"))
    ul.append(li)
    container.append(introText, ul)
    document.body.append(container)

    const originalHTML = container.innerHTML

    await translateNodeTranslationOnlyMode([li], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    await translateNodeTranslationOnlyMode([introText], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    expect(getWrappers(container).length).toBe(2)
    expect(container.textContent).not.toContain("Intro paragraph text.")

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()

    expect(container.innerHTML).toBe(originalHTML)
    // Node identity, not just markup: the same Text object is back in place
    expect(container.firstChild).toBe(introText)
    expect(li.firstChild).toBe(bold)
  })

  it("re-inserts the same element objects for a multi-node inline run", async () => {
    const container = document.createElement("div")
    const spanA = document.createElement("span")
    spanA.textContent = "First part"
    const textB = document.createTextNode(" and second part")
    container.append(spanA, textB)
    document.body.append(container)

    await translateNodeTranslationOnlyMode([spanA, textB], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(container.contains(spanA)).toBe(false)

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()

    expect(container.children[0]).toBe(spanA)
    expect(spanA.nextSibling).toBe(textB)
    expect(getWrappers().length).toBe(0)
  })

  it("never touches untranslated siblings (no ancestor blast radius)", async () => {
    const container = document.createElement("div")
    const pA = document.createElement("p")
    pA.textContent = "Translate me"
    const pB = document.createElement("p")
    pB.textContent = "Leave me alone"
    const pBText = pB.firstChild
    container.append(pA, pB)
    document.body.append(container)

    await translateNodeTranslationOnlyMode([pA], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()

    // The old code rewrote the shared parent's innerHTML, cloning pB
    expect(container.children[1]).toBe(pB)
    expect(pB.firstChild).toBe(pBText)
  })

  it("toggle removes the translation and restores originals without retranslating", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    const originalText = p.firstChild
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(p.textContent).toContain("中文译文")

    await translateNodeTranslationOnlyMode([p], "walk-2", DEFAULT_CONFIG, true)
    flushBatchedOperations()

    expect(p.textContent).toBe("Original sentence")
    expect(p.firstChild).toBe(originalText)
    expect(getWrappers().length).toBe(0)
    expect(mockTranslateTextForPage).toHaveBeenCalledTimes(1)
  })

  it("retranslate (non-toggle) restores then translates the same nodes again", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    await translateNodeTranslationOnlyMode([p], "walk-2", DEFAULT_CONFIG, false)
    await vi.waitFor(() => {
      flushBatchedOperations()
      expect(mockTranslateTextForPage).toHaveBeenCalledTimes(2)
    })
    flushBatchedOperations()

    expect(getWrappers(p).length).toBe(1)
    expect(p.textContent).toContain("中文译文")

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()
    expect(p.textContent).toBe("Original sentence")
  })

  it("does not remove originals when cleanup ran while translation was in flight", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    document.body.append(p)

    let resolveTranslation!: (value: string) => void
    mockTranslateTextForPage.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveTranslation = resolve
      }),
    )

    const translation = translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    await vi.waitFor(() =>
      expect(getWrappers(p).length + getWrappers(document).length).toBeGreaterThan(0),
    )
    flushBatchedOperations()

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()

    resolveTranslation("中文译文")
    await translation
    flushBatchedOperations()

    expect(p.textContent).toBe("Original sentence")
    expect(getWrappers().length).toBe(0)
  })

  it("returns nothing and leaves the DOM alone when the host removed the wrapper", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    const wrapper = getWrappers(p)[0]
    expect(wrapper).toBeDefined()
    // Host (framework re-render) removes the wrapper wholesale
    wrapper.remove()
    const htmlAfterHostRemoval = document.body.innerHTML

    const restored = removeTranslatedWrapperWithRestore(wrapper)
    flushBatchedOperations()

    expect(restored).toEqual([])
    expect(document.body.innerHTML).toBe(htmlAfterHostRemoval)
  })

  it("does not duplicate an original the host already re-attached", async () => {
    const p = document.createElement("p")
    const originalText = document.createTextNode("Original sentence")
    p.append(originalText)
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    // Host re-attaches the original text node on its own (framework re-render)
    p.append(originalText)

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()

    expect(p.textContent).toBe("Original sentence")
    expect([...p.childNodes].filter((n) => n === originalText).length).toBe(1)
  })

  it("keeps originals when the provider returns an empty translation", async () => {
    mockTranslateTextForPage.mockResolvedValue("")
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    const originalText = p.firstChild
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    expect(p.textContent).toBe("Original sentence")
    expect(p.firstChild).toBe(originalText)
    expect(getWrappers().length).toBe(0)

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()
    expect(p.textContent).toBe("Original sentence")
  })
})
