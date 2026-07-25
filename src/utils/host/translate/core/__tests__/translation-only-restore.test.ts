// @vitest-environment jsdom
// Node-identity restore for translationOnly mode (#1846): originals displaced by
// a translation wrapper are retained as ChildNode objects and re-inserted on
// restore — never rebuilt from an ancestor innerHTML snapshot.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS, TRANSLATION_ONLY_ATTRIBUTE } from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "../../../dom/batch-dom"
import {
  removeAllTranslatedWrapperNodes,
  removeTranslatedWrapperWithRestore,
} from "../../dom/translation-cleanup"
import { translateNodesBilingualMode, translateNodeTranslationOnlyMode } from "../translation-modes"
import { findStaleTranslationOnlyAnchor } from "../translation-state"

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

    // The structural li run falls back to a wrapper (plain-text mock can't be
    // paired); the loose text run swaps in place on the container anchor.
    expect(getWrappers(container).length).toBe(1)
    expect(container.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(true)
    expect(container.textContent).not.toContain("Intro paragraph text.")

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()

    expect(container.innerHTML).toBe(originalHTML)
    expect(container.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
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

  it("retranslate (non-toggle) restores the swap then translates again", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    const originalText = p.firstChild
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(p.textContent).toBe("中文译文")

    await translateNodeTranslationOnlyMode([p], "walk-2", DEFAULT_CONFIG, false)
    flushBatchedOperations()

    expect(mockTranslateTextForPage).toHaveBeenCalledTimes(2)
    expect(getWrappers(p).length).toBe(0)
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(true)
    expect(p.firstChild).toBe(originalText)
    expect(p.textContent).toBe("中文译文")

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()
    expect(p.textContent).toBe("Original sentence")
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
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
    // Structural content so the plain-text mock forces the wrapper fallback
    const p = document.createElement("p")
    const bold = document.createElement("b")
    bold.textContent = "Bold lead"
    p.append(bold, document.createTextNode(" tail text"))
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

  it("swaps a single-text paragraph in place, preserving node identity", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    const originalText = p.firstChild as Text
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    expect(getWrappers().length).toBe(0)
    expect(p.firstChild).toBe(originalText)
    expect(originalText.data).toBe("中文译文")
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(true)

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()
    expect(p.firstChild).toBe(originalText)
    expect(originalText.data).toBe("Original sentence")
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
  })

  it("guarded restore never clobbers text the framework rewrote after the swap", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    const originalText = p.firstChild as Text
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(originalText.data).toBe("中文译文")

    // Framework re-render rewrites the swapped node with fresh host content
    originalText.data = "Fresh host content"

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()

    expect(originalText.data).toBe("Fresh host content")
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
  })

  it("drops the translation when the host mutated the run while the request was in flight", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    const originalText = p.firstChild as Text
    document.body.append(p)

    let resolveTranslation!: (value: string) => void
    mockTranslateTextForPage.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveTranslation = resolve
      }),
    )

    const translation = translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    // Wait until the request is actually in flight (snapshot already taken),
    // then let the host rewrite the text before the response lands
    await vi.waitFor(() => expect(mockTranslateTextForPage).toHaveBeenCalled())
    originalText.data = "Host changed this mid-flight"

    resolveTranslation("中文译文")
    await translation
    flushBatchedOperations()

    expect(originalText.data).toBe("Host changed this mid-flight")
    expect(getWrappers().length).toBe(0)
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
  })

  it("swaps translated human-visible attributes and restores them guardedly", async () => {
    mockTranslateTextForPage.mockResolvedValue('前缀 <a href="/x" title="城市">链接</a> 后缀')
    const p = document.createElement("p")
    const link = document.createElement("a")
    link.setAttribute("href", "/x")
    link.setAttribute("title", "City")
    link.textContent = "link"
    p.append(document.createTextNode("prefix "), link, document.createTextNode(" suffix"))
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    expect(getWrappers().length).toBe(0)
    expect(p.children[0]).toBe(link)
    expect(link.getAttribute("title")).toBe("城市")
    expect(link.textContent).toBe("链接")

    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()
    expect(link.getAttribute("title")).toBe("City")
    expect(link.textContent).toBe("link")
    expect(p.textContent).toBe("prefix link suffix")
  })

  it("detects host expansion of swapped content and retranslates it (X show-more)", async () => {
    const p = document.createElement("p")
    p.textContent = "Short truncated tweet"
    const textNode = p.firstChild as Text
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(textNode.data).toBe("中文译文")
    // Untouched anchor is NOT stale
    expect(findStaleTranslationOnlyAnchor(textNode)).toBeUndefined()

    // Host expands the tweet ("show more"): rewrites the swapped node
    textNode.data = "Short truncated tweet plus the long expanded remainder"
    expect(findStaleTranslationOnlyAnchor(textNode)).toBe(p)

    // What the manager's retranslation pipeline runs for a stale anchor
    mockTranslateTextForPage.mockResolvedValue("完整中文译文")
    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    // Provider saw the CURRENT host text, not the old translation
    const lastRequest = String(mockTranslateTextForPage.mock.calls.at(-1)![0])
    expect(lastRequest).toContain("expanded remainder")
    expect(p.textContent).toBe("完整中文译文")
    expect(findStaleTranslationOnlyAnchor(textNode)).toBeUndefined()

    // Show original returns the host's EXPANDED text, not the stale short one
    removeAllTranslatedWrapperNodes(document)
    flushBatchedOperations()
    expect(p.textContent).toBe("Short truncated tweet plus the long expanded remainder")
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
  })

  it("toggle-off converges for a container mixing a swapped run and a nested wrapper run", async () => {
    // Adversarial-review finding: the loose-text run's toggle must restore its
    // OWN swap, not steal the nested li's wrapper and re-translate forever.
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

    // Press 1: translate (walker order — loose run first, then the li)
    await translateNodeTranslationOnlyMode([introText], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    await translateNodeTranslationOnlyMode([li], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(mockTranslateTextForPage).toHaveBeenCalledTimes(2)
    expect(container.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(true)
    expect(getWrappers(container).length).toBe(1)

    // Press 2 ("hide"): same walker order, fresh walkId, toggle=true
    await translateNodeTranslationOnlyMode([introText], "walk-2", DEFAULT_CONFIG, true)
    flushBatchedOperations()
    await translateNodeTranslationOnlyMode([li], "walk-2", DEFAULT_CONFIG, true)
    flushBatchedOperations()

    expect(container.innerHTML).toBe(originalHTML)
    expect(container.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
    expect(getWrappers().length).toBe(0)
    // No extra provider calls: the hide press translated nothing
    expect(mockTranslateTextForPage).toHaveBeenCalledTimes(2)
  })

  it("bilingual toggle restores an in-place swap left by a translationOnly session", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    const originalText = p.firstChild
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(p.textContent).toBe("中文译文")

    // Mode switched to bilingual without a full cleanup; node-level toggle
    const bilingualConfig = {
      ...DEFAULT_CONFIG,
      translate: { ...DEFAULT_CONFIG.translate, mode: "bilingual" as const },
    }
    await translateNodesBilingualMode([p], "walk-2", bilingualConfig, true)
    flushBatchedOperations()

    expect(p.textContent).toBe("Original sentence")
    expect(p.firstChild).toBe(originalText)
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
    expect(mockTranslateTextForPage).toHaveBeenCalledTimes(1)
  })

  it("detects a host replacement of a swapped run's text node", async () => {
    const p = document.createElement("p")
    p.textContent = "Existing sentence"
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    // Framework re-render swaps the text node object for a fresh one
    p.replaceChildren(document.createTextNode("Expanded replacement sentence"))
    expect(findStaleTranslationOnlyAnchor(p)).toBe(p)
  })

  it("nested anchors never make an ancestor anchor falsely stale (per-record staleness)", async () => {
    // div[looseText, p[text]] — both runs swap, anchors nest (div ⊃ p). The
    // old anchor-wide aggregate went permanently stale when the nested anchor
    // registered/unregistered; per-record staleness must stay quiet.
    const container = document.createElement("div")
    const looseText = document.createTextNode("Loose intro text. ")
    const inner = document.createElement("p")
    inner.textContent = "Nested paragraph text"
    container.append(looseText, inner)
    document.body.append(container)

    // Outer run swaps FIRST (its expected text computed while inner is
    // unregistered — the old design's poison window)
    await translateNodeTranslationOnlyMode([looseText], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    await translateNodeTranslationOnlyMode([inner], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    expect(findStaleTranslationOnlyAnchor(looseText)).toBeUndefined()
    expect(findStaleTranslationOnlyAnchor(inner.firstChild!)).toBeUndefined()

    // Toggling the nested run off must not flip the ancestor stale either
    await translateNodeTranslationOnlyMode([inner], "walk-2", DEFAULT_CONFIG, true)
    flushBatchedOperations()
    expect(findStaleTranslationOnlyAnchor(looseText)).toBeUndefined()
    expect(findStaleTranslationOnlyAnchor(inner)).toBeUndefined()
  })

  it("keeps monitoring a run whose retranslation was dropped by the mid-flight guard", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()
    expect(p.textContent).toBe("中文译文")

    // Host rewrite triggers a retranslation pass; the host rewrites AGAIN
    // while that pass's request is in flight, so the re-swap is dropped.
    const textNode = p.firstChild as Text
    textNode.data = "Expanded sentence one"
    let resolveTranslation!: (value: string) => void
    mockTranslateTextForPage.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveTranslation = resolve
      }),
    )
    const retranslation = translateNodeTranslationOnlyMode([p], "walk-2", DEFAULT_CONFIG)
    await vi.waitFor(() => expect(mockTranslateTextForPage).toHaveBeenCalledTimes(2))
    textNode.data = "Expanded sentence two (host rewrote mid-flight)"
    resolveTranslation("过期译文")
    await retranslation
    flushBatchedOperations()

    // The stale translation was dropped, but the anchor is still registered
    // and reads as stale — the budgeted pipeline will retry with fresh text.
    expect(p.textContent).toBe("Expanded sentence two (host rewrote mid-flight)")
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(true)
    expect(findStaleTranslationOnlyAnchor(textNode)).toBe(p)
  })

  it("prunes unrestorable records so a toggled-off anchor releases its marker", async () => {
    const p = document.createElement("p")
    p.textContent = "Original sentence"
    document.body.append(p)

    await translateNodeTranslationOnlyMode([p], "walk-1", DEFAULT_CONFIG)
    flushBatchedOperations()

    // Host replaces the entire content: every node the record references is
    // disconnected, nothing is restorable.
    p.replaceChildren(document.createTextNode("Host rebuilt everything"))

    await translateNodeTranslationOnlyMode([p], "walk-2", DEFAULT_CONFIG, true)
    flushBatchedOperations()

    expect(p.textContent).toBe("Host rebuilt everything")
    expect(p.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)).toBe(false)
    expect(findStaleTranslationOnlyAnchor(p)).toBeUndefined()
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
