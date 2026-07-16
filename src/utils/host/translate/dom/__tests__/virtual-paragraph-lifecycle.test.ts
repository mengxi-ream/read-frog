import type { VirtualParagraphUnit } from "../paragraph-segmentation"
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { CONTENT_WRAPPER_CLASS, NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import {
  collectSourceTextExcludingWrappers,
  getBilingualTranslationStateForSource,
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
import {
  disposeVirtualParagraphGroup,
  dropVirtualParagraphWrapper,
  removeAllTranslatedWrapperNodes,
} from "../translation-cleanup"
import { insertVirtualParagraphWrappers } from "../virtual-paragraph-insertion"

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
    wrapper: wrappers[index],
  }))
  const { splitRecords } = insertVirtualParagraphWrappers(entries, layoutSource)
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
    expect(group.splitRecords[0].source).toBe(source)
    expect(group.splitRecords[0].createdTails).toHaveLength(2)
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
    const tails = [...group.splitRecords[0].createdTails]

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
    const tails = [...group.splitRecords[0].createdTails]
    const siteNode = document.createElement("span")
    siteNode.textContent = "site content"

    layoutSource.insertBefore(siteNode, tails[0])

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
    const tails = [...group.splitRecords[0].createdTails]

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
    const tails = [...group.splitRecords[0].createdTails]
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
    const tails = [...group.splitRecords[0].createdTails]
    const replacement = document.createTextNode("replacement")

    tails[1].data = "edited by host"
    source.replaceWith(replacement)

    expect(disposeVirtualParagraphGroup(group)).toEqual({ restored: 0, skipped: 1 })
    expect(layoutSource.firstChild).toBe(replacement)
    expect(tails[0].isConnected).toBe(false)
    expect(tails[1].isConnected).toBe(true)
    expect(tails[1].data).toBe("edited by host")
  })

  it("keeps split state until the last wrapper is dropped", () => {
    const originalValue = "one\n\ntwo"
    const layoutSource = document.createElement("div")
    const source = document.createTextNode(originalValue)
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, originalValue.length])
    const tail = group.splitRecords[0].createdTails[0]

    dropVirtualParagraphWrapper(group, wrappers[0])

    expect(group.status).toBe("active")
    expect(group.wrappers).toEqual(new Set([wrappers[1]]))
    expect(source.data).toBe("one")
    expect(tail.isConnected).toBe(true)
    expect(getVirtualParagraphGroupForSource(layoutSource)).toBe(group)

    dropVirtualParagraphWrapper(group, wrappers[1])

    expect(group.status).toBe("disposed")
    expect(layoutSource.firstChild).toBe(source)
    expect(source.data).toBe(originalValue)
    expect(tail.isConnected).toBe(false)
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
    wrappers[0].remove()

    expect(isVirtualParagraphGroupCurrent(group)).toBe(false)
    disposeVirtualParagraphGroup(group)
  })

  it("treats a tracked wrapper moved within the layout source as stale", () => {
    const layoutSource = document.createElement("div")
    const source = document.createTextNode("one\n\ntwo")
    layoutSource.append(source)
    document.body.append(layoutSource)
    const { group, wrappers } = createSplitGroup(layoutSource, source, [3, source.data.length])

    layoutSource.append(wrappers[0])

    expect(isVirtualParagraphGroupCurrent(group)).toBe(false)
    disposeVirtualParagraphGroup(group)
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
