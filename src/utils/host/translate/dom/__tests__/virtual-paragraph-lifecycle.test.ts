import type { VirtualParagraphUnit } from "../paragraph-segmentation"
// @vitest-environment jsdom
import type { TransNode } from "@/types/dom"
import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  TRANSLATION_ONLY_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import {
  collectSourceTextExcludingWrappers,
  getBilingualTranslationStateForSource,
  getTranslationOnlyAnchorState,
  getVirtualParagraphGroupForSource,
  getVirtualParagraphGroupForWrapper,
  isBilingualTranslationStateCurrent,
  isVirtualParagraphGroupCurrent,
  markVirtualParagraphGroupInserted,
  registerBilingualTranslationState,
  registerVirtualParagraphGroup,
  type BilingualTranslationState,
  type VirtualParagraphGroup,
} from "../../core/translation-state"
import { buildVirtualParagraphPlan } from "../paragraph-segmentation"
import {
  disposeVirtualParagraphGroup,
  dropVirtualParagraphWrapper,
  removeAllTranslatedWrapperNodes,
  restoreTranslationOnlySwapsForAnchor,
  teardownVirtualTranslationOnlyGeneration,
} from "../translation-cleanup"
import { applyInPlaceTextSwap, ensureTranslationOnlyAnchorState } from "../translation-text-swap"
import {
  insertVirtualParagraphWrappers,
  materializeVirtualParagraphUnitRuns,
} from "../virtual-paragraph-insertion"

function unit(id: number, source: Text, offset: number): VirtualParagraphUnit {
  return {
    id,
    text: `paragraph-${id}`,
    insertionBoundary: { container: source, offset },
    sourceFragments: [],
  }
}

function createSplitGroup(
  layoutSource: HTMLElement,
  source: Text,
  offsets: number[],
  id: string = "generation",
): { group: VirtualParagraphGroup; wrappers: HTMLElement[] } {
  const sourceTextContent = layoutSource.textContent ?? ""
  const wrappers = offsets.map(() => document.createElement("div"))
  const entries = offsets.map((offset, index) => ({
    unit: unit(index, source, offset),
    wrapper: wrappers[index]!,
  }))
  const { splitRecords } = insertVirtualParagraphWrappers(entries)
  const group: VirtualParagraphGroup = {
    id,
    walkId: id,
    status: "active",
    layoutSource,
    wrappers: new Set(wrappers),
    splitRecords,
    sourceSnapshots: [],
    sourceTextContent,
    wrapperPlacements: new Map(),
  }
  registerVirtualParagraphGroup(group)
  markVirtualParagraphGroupInserted(group)
  return { group, wrappers }
}

beforeEach(() => {
  document.body.replaceChildren()
})

describe("virtual paragraph lifecycle", () => {
  it("restores one Text split at multiple reverse-applied boundaries without changing its identity", () => {
    const originalValue = "one\n\ntwo\n\nthree"
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)

    const { group } = createSplitGroup(layoutSource, source, [3, 8, originalValue.length])

    expect(group.splitRecords).toHaveLength(1)
    expect(group.splitRecords[0]!.source).toBe(source)
    expect(group.splitRecords[0]!.createdTails).toHaveLength(2)
    expect(layoutSource.textContent).toBe(originalValue)

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 1, skipped: 0 })
    expect(layoutSource.childNodes).toHaveLength(1)
    expect(layoutSource.firstChild).toBe(source)
    expect(source.data).toBe(originalValue)
  })

  it("disposes idempotently", () => {
    const layoutSource = document.createElement("div")
    const source = document.createTextNode("one\n\ntwo")
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group } = createSplitGroup(layoutSource, source, [3, source.data.length])

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 1, skipped: 0 })
    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 0, skipped: 0 })
    expect(layoutSource.firstChild).toBe(source)
    expect(source.data).toBe("one\n\ntwo")
  })

  it("removes proven duplicate tails when the host rewrites the source in place", () => {
    const originalValue = "one\n\ntwo\n\nthree"
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, 8])
    const tails = [...group.splitRecords[0]!.createdTails]

    source.data = "host update"

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 1, skipped: 0 })
    expect(source.data).toBe("host update")
    expect(layoutSource.childNodes).toHaveLength(1)
    expect(layoutSource.firstChild).toBe(source)
    expect(tails.every((tail) => !tail.isConnected)).toBe(true)
    expect(wrappers.every((wrapper) => !wrapper.isConnected)).toBe(true)
  })

  it("preserves split fragments when the site inserts its own node between them", () => {
    const originalValue = "one\n\ntwo\n\nthree"
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, 8])
    const tails = [...group.splitRecords[0]!.createdTails]
    const siteNode = document.createElement("span")
    siteNode.textContent = "site content"

    layoutSource.insertBefore(siteNode, tails[0]!)

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 0, skipped: 1 })
    expect(source.data).toBe("one")
    expect(siteNode.isConnected).toBe(true)
    expect(tails.every((tail) => tail.isConnected)).toBe(true)
    expect(tails.every((tail) => layoutSource.contains(tail))).toBe(true)
    expect(tails.map((tail) => tail.data)).toEqual(["\n\ntwo", "\n\nthree"])
    expect(wrappers.every((wrapper) => !wrapper.isConnected)).toBe(true)
  })

  it("removes proven duplicate tails when the host expands the original Text node", () => {
    const originalValue = "one\n\ntwo\n\nthree"
    const expandedValue = `${originalValue} with expanded content`
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group } = createSplitGroup(layoutSource, source, [3, 8])
    const tails = [...group.splitRecords[0]!.createdTails]

    source.data = expandedValue

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 1, skipped: 0 })
    expect(source.data).toBe(expandedValue)
    expect(layoutSource.childNodes).toHaveLength(1)
    expect(layoutSource.firstChild).toBe(source)
    expect(tails.every((tail) => !tail.isConnected)).toBe(true)
  })

  it("removes connected unchanged tails when the host replaces the source Text node", () => {
    const originalValue = "one\n\ntwo\n\nthree"
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, 8])
    const tails = [...group.splitRecords[0]!.createdTails]
    const replacement = document.createTextNode("replacement")

    source.replaceWith(replacement)

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 0, skipped: 1 })
    expect(replacement.data).toBe("replacement")
    expect(layoutSource.childNodes).toHaveLength(1)
    expect(layoutSource.firstChild).toBe(replacement)
    expect(tails.every((tail) => !tail.isConnected)).toBe(true)
    expect(wrappers.every((wrapper) => !wrapper.isConnected)).toBe(true)
  })

  it("keeps a host-edited tail when the source Text node is replaced", () => {
    const originalValue = "one\n\ntwo\n\nthree"
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group } = createSplitGroup(layoutSource, source, [3, 8])
    const tails = [...group.splitRecords[0]!.createdTails]
    const replacement = document.createTextNode("replacement")

    tails[1]!.data = "edited by host"
    source.replaceWith(replacement)

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 0, skipped: 1 })
    expect(layoutSource.firstChild).toBe(replacement)
    expect(tails[0]!.isConnected).toBe(false)
    expect(tails[1]!.isConnected).toBe(true)
    expect(tails[1]!.data).toBe("edited by host")
  })

  it("keeps split state until the last wrapper is dropped", () => {
    const originalValue = "one\n\ntwo"
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, originalValue.length])
    const tail = group.splitRecords[0]!.createdTails[0]

    dropVirtualParagraphWrapper(group, wrappers[0]!)

    expect(group.status).toBe("active")
    expect(group.wrappers).toEqual(new Set([wrappers[1]]))
    expect(source.data).toBe("one")
    expect(tail!.isConnected).toBe(true)
    expect(getVirtualParagraphGroupForSource(layoutSource)).toBe(group)

    dropVirtualParagraphWrapper(group, wrappers[1]!)

    expect(group.status).toBe("disposed")
    expect(layoutSource.firstChild).toBe(source)
    expect(source.data).toBe(originalValue)
    expect(tail!.isConnected).toBe(false)
    expect(getVirtualParagraphGroupForSource(layoutSource)).toBeUndefined()
  })

  it("does not erase a newer generation mapping when disposing an old generation", () => {
    const layoutSource = document.createElement("div")
    document.body.append(layoutSource)
    const oldWrapper = document.createElement("div")
    const newWrapper = document.createElement("div")
    layoutSource.append(oldWrapper, newWrapper)
    const oldGroup: VirtualParagraphGroup = {
      id: "old",
      walkId: "old",
      status: "active",
      layoutSource,
      wrappers: new Set([oldWrapper]),
      splitRecords: [],
      sourceSnapshots: [],
      sourceTextContent: "",
      wrapperPlacements: new Map(),
    }
    const newGroup: VirtualParagraphGroup = {
      id: "new",
      walkId: "new",
      status: "active",
      layoutSource,
      wrappers: new Set([newWrapper]),
      splitRecords: [],
      sourceSnapshots: [],
      sourceTextContent: "",
      wrapperPlacements: new Map(),
    }
    registerVirtualParagraphGroup(oldGroup)
    registerVirtualParagraphGroup(newGroup)
    markVirtualParagraphGroupInserted(oldGroup)
    markVirtualParagraphGroupInserted(newGroup)

    disposeVirtualParagraphGroup(oldGroup)

    expect(getVirtualParagraphGroupForSource(layoutSource)).toBe(newGroup)
    expect(getVirtualParagraphGroupForWrapper(newWrapper)).toBe(newGroup)
    expect(newGroup.status).toBe("active")
    expect(newWrapper.isConnected).toBe(true)
    expect(oldWrapper.isConnected).toBe(false)

    disposeVirtualParagraphGroup(newGroup)
  })

  it("cancels a pending group before its wrappers have been inserted", () => {
    const layoutSource = document.createElement("div")
    document.body.append(layoutSource)
    const group: VirtualParagraphGroup = {
      id: "pending",
      walkId: "pending",
      status: "active",
      layoutSource,
      wrappers: new Set(),
      splitRecords: [],
      sourceSnapshots: [],
      sourceTextContent: "",
      wrapperPlacements: new Map(),
    }
    registerVirtualParagraphGroup(group)

    removeAllTranslatedWrapperNodes(document)

    expect(group.status).toBe("disposed")
    expect(getVirtualParagraphGroupForSource(layoutSource)).toBeUndefined()
  })

  it("cancels a pending legacy bilingual translation before wrapper insertion", () => {
    const layoutSource = document.createElement("div")
    layoutSource.textContent = "Pending source"
    document.body.append(layoutSource)
    const state: BilingualTranslationState = {
      layoutSource,
      sourceTextContent: "Pending source",
      status: "active",
      walkId: "pending-legacy",
      wrapper: null,
      wrapperTextContent: null,
    }
    registerBilingualTranslationState(state)

    removeAllTranslatedWrapperNodes(document)

    expect(state.status).toBe("disposed")
    expect(getBilingualTranslationStateForSource(layoutSource)).toBeUndefined()
  })

  it("does not stale a bilingual state when a foreign translation wrapper is inserted (#1831)", () => {
    const layoutSource = document.createElement("div")
    layoutSource.textContent = "Host paragraph text"
    const ownWrapper = document.createElement("span")
    ownWrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    ownWrapper.textContent = "自己的译文"
    layoutSource.append(ownWrapper)
    document.body.append(layoutSource)
    const state: BilingualTranslationState = {
      layoutSource,
      sourceTextContent: "Host paragraph text",
      status: "active",
      walkId: "foreign-wrapper",
      wrapper: ownWrapper,
      wrapperTextContent: null,
    }
    registerBilingualTranslationState(state)
    expect(isBilingualTranslationStateCurrent(state)).toBe(true)

    const foreignWrapper = document.createElement("span")
    foreignWrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    foreignWrapper.textContent = "后代状态的译文"
    layoutSource.append(foreignWrapper)
    expect(isBilingualTranslationStateCurrent(state)).toBe(true)

    layoutSource.append("real host change")
    expect(isBilingualTranslationStateCurrent(state)).toBe(false)
  })

  it("does not stale a virtual paragraph group when a foreign translation wrapper is inserted (#1831)", () => {
    const layoutSource = document.createElement("div")
    const nested = document.createElement("em")
    nested.textContent = "nested"
    const source = document.createTextNode("one\n\ntwo")
    layoutSource.append(nested, source)
    document.body.append(layoutSource)
    const { group } = createSplitGroup(layoutSource, source, [3, source.data.length])
    expect(isVirtualParagraphGroupCurrent(group)).toBe(true)

    // A descendant paragraph's wrapper lands inside a nested element, away from
    // the group's own wrappers, so placement fingerprints stay intact.
    const foreignWrapper = document.createElement("span")
    foreignWrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    foreignWrapper.textContent = "后代状态的译文"
    nested.append(foreignWrapper)
    expect(isVirtualParagraphGroupCurrent(group)).toBe(true)

    nested.append("real host change")
    expect(isVirtualParagraphGroupCurrent(group)).toBe(false)
    disposeVirtualParagraphGroup(group)
  })

  it("captures registration snapshots that exclude pre-existing wrappers (snapshot symmetry)", () => {
    const layoutSource = document.createElement("div")
    layoutSource.textContent = "Host text"
    const preexistingWrapper = document.createElement("span")
    preexistingWrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    preexistingWrapper.textContent = "旧译文"
    layoutSource.append(preexistingWrapper)
    document.body.append(layoutSource)

    const state: BilingualTranslationState = {
      layoutSource,
      sourceTextContent: collectSourceTextExcludingWrappers(layoutSource),
      status: "active",
      walkId: "snapshot-symmetry",
      wrapper: null,
      wrapperTextContent: null,
    }
    registerBilingualTranslationState(state)

    expect(isBilingualTranslationStateCurrent(state)).toBe(true)
  })

  it("treats a removed tracked wrapper as stale after insertion", () => {
    const layoutSource = document.createElement("div")
    const source = document.createTextNode("one\n\ntwo")
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, source.data.length])

    expect(isVirtualParagraphGroupCurrent(group)).toBe(true)
    wrappers[0]!.remove()

    expect(isVirtualParagraphGroupCurrent(group)).toBe(false)
    disposeVirtualParagraphGroup(group)
  })

  it("treats a tracked wrapper moved within the layout source as stale", () => {
    const layoutSource = document.createElement("div")
    const source = document.createTextNode("one\n\ntwo")
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, source.data.length])

    layoutSource.append(wrappers[0]!)

    expect(isVirtualParagraphGroupCurrent(group)).toBe(false)
    disposeVirtualParagraphGroup(group)
  })

  describe("translationOnly virtual generation teardown", () => {
    // A translationOnly generation has no wrapper of its own: each unit is a
    // run of whole child nodes whose text was swapped in place, with the Text
    // cuts that made them whole nodes owned by the container's anchor state.
    function createSwappedGeneration(storyText: string) {
      const layoutSource = document.createElement("div")
      layoutSource.style.whiteSpace = "pre-wrap"
      layoutSource.textContent = storyText
      document.body.append(layoutSource)

      const plan = buildVirtualParagraphPlan(layoutSource, DEFAULT_CONFIG)
      const state = ensureTranslationOnlyAnchorState(
        layoutSource,
        DEFAULT_CONFIG,
        getTranslationOnlyAnchorState,
      )
      state.splitRecords = []
      state.virtualGeneration = 1
      const runs = materializeVirtualParagraphUnitRuns(
        layoutSource,
        plan,
        DEFAULT_CONFIG,
        state.splitRecords,
      )!

      return { layoutSource, runs, state }
    }

    function swapRun(
      layoutSource: HTMLElement,
      run: { nodes: ChildNode[] },
      translation: string,
      walkId: string = "generation-1",
    ) {
      const node = run.nodes[0] as Text
      applyInPlaceTextSwap(
        { pairs: [{ node, translatedValue: translation }], attributePairs: [], coverage: 1 },
        run.nodes as TransNode[],
        layoutSource,
        walkId,
        DEFAULT_CONFIG,
        getTranslationOnlyAnchorState,
      )
    }

    it("restores swapped text and rejoins the cuts", () => {
      const storyText = "First paragraph.\n\nSecond paragraph."
      const { layoutSource, runs } = createSwappedGeneration(storyText)
      swapRun(layoutSource, runs[0]!, "【第一段】")
      swapRun(layoutSource, runs[1]!, "【第二段】")
      expect(layoutSource.textContent).toBe("【第一段】\n\n【第二段】")

      teardownVirtualTranslationOnlyGeneration(layoutSource)

      expect(layoutSource.textContent).toBe(storyText)
      // The cuts are rejoined, so the container is back to a single Text node.
      expect(layoutSource.childNodes).toHaveLength(1)
      expect(layoutSource).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
      expect(getTranslationOnlyAnchorState(layoutSource)).toBeUndefined()
    })

    it("clears a unit wrapper that would otherwise block the rejoin", () => {
      // A unit still awaiting its provider holds a spinner wrapper sitting
      // between a cut source and its tail; leaving it there would make
      // restoreTextSplit refuse and strand the split nodes forever.
      const storyText = "First paragraph.\n\nSecond paragraph."
      const { layoutSource, runs } = createSwappedGeneration(storyText)
      swapRun(layoutSource, runs[0]!, "【第一段】")

      const pendingWrapper = document.createElement("span")
      pendingWrapper.className = CONTENT_WRAPPER_CLASS
      pendingWrapper.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "translationOnly")
      runs[1]!.nodes[0]!.after(pendingWrapper)

      teardownVirtualTranslationOnlyGeneration(layoutSource)

      expect(pendingWrapper.isConnected).toBe(false)
      expect(layoutSource.textContent).toBe(storyText)
      expect(layoutSource.childNodes).toHaveLength(1)
    })

    it("restores a unit whose record lives on a descendant anchor", () => {
      // A unit that is a single element unwraps into that element, so its swap
      // record anchors there — an ancestor-only lookup would never find it.
      const layoutSource = document.createElement("div")
      layoutSource.style.whiteSpace = "pre-wrap"
      layoutSource.innerHTML = "<span>First paragraph.</span>\n\n<span>Second paragraph.</span>"
      document.body.append(layoutSource)
      const [firstSpan, secondSpan] = [...layoutSource.querySelectorAll("span")]
      const state = ensureTranslationOnlyAnchorState(
        layoutSource,
        DEFAULT_CONFIG,
        getTranslationOnlyAnchorState,
      )
      state.virtualGeneration = 1

      const secondText = secondSpan!.firstChild as Text
      applyInPlaceTextSwap(
        {
          pairs: [{ node: secondText, translatedValue: "【第二段】" }],
          attributePairs: [],
          coverage: 1,
        },
        [secondText],
        secondSpan!,
        "generation-1",
        DEFAULT_CONFIG,
        getTranslationOnlyAnchorState,
      )
      expect(secondSpan).toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)

      teardownVirtualTranslationOnlyGeneration(layoutSource)

      expect(secondSpan!.textContent).toBe("Second paragraph.")
      expect(secondSpan).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
      expect(layoutSource).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
      expect(firstSpan!.textContent).toBe("First paragraph.")
    })

    it("keeps the anchor alive while the generation still has units in flight", () => {
      // Between units the container's own swap list is legitimately empty, and
      // finalizing there would rejoin the cuts under the pending units' feet.
      const { layoutSource, state } = createSwappedGeneration("First.\n\nSecond.")

      restoreTranslationOnlySwapsForAnchor(layoutSource)

      expect(getTranslationOnlyAnchorState(layoutSource)).toBe(state)
      expect(layoutSource).toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
      expect(layoutSource.childNodes.length).toBeGreaterThan(1)

      teardownVirtualTranslationOnlyGeneration(layoutSource)

      expect(getTranslationOnlyAnchorState(layoutSource)).toBeUndefined()
      expect(layoutSource.childNodes).toHaveLength(1)
    })

    it("is covered by a page-wide cleanup", () => {
      const storyText = "First paragraph.\n\nSecond paragraph."
      const { layoutSource, runs } = createSwappedGeneration(storyText)
      swapRun(layoutSource, runs[0]!, "【第一段】")
      swapRun(layoutSource, runs[1]!, "【第二段】")
      // A page-wide stop does not know about generations; it finds the anchor
      // by the marker the materialization claimed up front.
      const state = getTranslationOnlyAnchorState(layoutSource)!
      state.virtualGeneration = undefined

      removeAllTranslatedWrapperNodes(document)

      expect(layoutSource.textContent).toBe(storyText)
      expect(layoutSource.childNodes).toHaveLength(1)
      expect(layoutSource).not.toHaveAttribute(TRANSLATION_ONLY_ATTRIBUTE)
    })
  })

  it("cancels pending groups inside an attached shadow root during document cleanup", () => {
    const host = document.createElement("div")
    const shadowRoot = host.attachShadow({ mode: "open" })
    const layoutSource = document.createElement("div")
    shadowRoot.append(layoutSource)
    document.body.append(host)
    const group: VirtualParagraphGroup = {
      id: "shadow-pending",
      walkId: "shadow-pending",
      status: "active",
      layoutSource,
      wrappers: new Set(),
      splitRecords: [],
      sourceSnapshots: [],
      sourceTextContent: "",
      wrapperPlacements: new Map(),
    }
    registerVirtualParagraphGroup(group)

    removeAllTranslatedWrapperNodes(document)

    expect(group.status).toBe("disposed")
    expect(getVirtualParagraphGroupForSource(layoutSource)).toBeUndefined()
  })
})
