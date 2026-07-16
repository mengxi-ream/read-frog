import type {
  TextSplitRecord,
  TranslationOnlyAnchorState,
  TranslationOnlySwapRecord,
  VirtualParagraphGroup,
} from "../core/translation-state"
import {
  CONTENT_WRAPPER_CLASS,
  REACT_SHADOW_HOST_CLASS,
  SPINNER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  TRANSLATION_ONLY_ATTRIBUTE,
  VIRTUAL_PARAGRAPH_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { removeReactShadowHost } from "../../../react-shadow-host/create-shadow-host"
import { isHTMLElement, isTranslatedWrapperNode } from "../../dom/filter"
import { deepQueryAllSelector, deepQueryTopLevelSelector } from "../../dom/find"
import {
  dropTranslationOnlySwapRecords,
  getBilingualTranslationStateForWrapper,
  getPendingBilingualTranslationStates,
  getPendingVirtualParagraphGroups,
  getTranslationOnlyAnchorState,
  getVirtualParagraphGroupForSource,
  getVirtualParagraphGroupForWrapper,
  isTranslationOnlySwapRecordDead,
  markExtensionDrivenCharacterData,
  markExtensionDrivenNodeRemoval,
  refreshTranslationOnlySwapRecordExpectedText,
  swapRecordIntersectsNodes,
  takeTranslationOnlyOriginals,
  unregisterBilingualTranslationState,
  unregisterTranslationOnlyAnchorState,
  unregisterVirtualParagraphGroup,
  unregisterVirtualParagraphWrapper,
} from "../core/translation-state"

export function removeShadowHostInTranslatedWrapper(wrapper: HTMLElement): void {
  // Remove React shadow hosts (for error components)
  const translationShadowHost = wrapper.querySelector(`.${REACT_SHADOW_HOST_CLASS}`)
  if (translationShadowHost && isHTMLElement(translationShadowHost)) {
    removeReactShadowHost(translationShadowHost)
  }

  // Remove lightweight spinners; cancel their infinite animation first so the
  // detached node is not rooted by the renderer (#1831).
  const spinner = wrapper.querySelector(`.${SPINNER_CLASS}`)
  if (spinner && isHTMLElement(spinner)) {
    spinner.getAnimations?.().forEach((animation) => animation.cancel())
    spinner.remove()
  }
}

function restoreTextSplit(record: TextSplitRecord): boolean {
  const {
    source,
    parent,
    originalValue,
    createdTails,
    sourceValueAfterSplit,
    tailValuesAfterSplit,
  } = record
  const isUnchangedTail = (tail: Text, index: number) => tail.data === tailValuesAfterSplit[index]

  if (!source.isConnected || source.parentNode !== parent) {
    // The host replaced or moved the original Text node, so the split can never
    // be rejoined. Tails still connected with their post-split values are stale
    // fragments of content the replacement already owns; leaving them would
    // duplicate the old tail text next to the host's new content (#1831).
    createdTails.forEach((tail, index) => {
      if (tail.isConnected && isUnchangedTail(tail, index)) tail.remove()
    })
    return false
  }

  let previous: Text = source
  for (const tail of createdTails) {
    if (!tail.isConnected || tail.parentNode !== parent || previous.nextSibling !== tail) {
      // The site inserted its own nodes between the fragments. The tails are
      // real halves of live host content there, and removing them would delete
      // host text (#249) — leave the split in place.
      return false
    }
    previous = tail
  }

  const currentValue = [source, ...createdTails].map((node) => node.data).join("")
  if (currentValue === originalValue) {
    source.data = originalValue
    createdTails.forEach((tail) => tail.remove())
    return true
  }

  const tailsAreUnchanged = createdTails.every(isUnchangedTail)
  if (tailsAreUnchanged && source.data !== sourceValueAfterSplit) {
    // Frameworks such as React rewrite their original Text node with the
    // complete new value while leaving splitText-created tails behind. With
    // the chain intact and every tail still holding its post-split value, the
    // tails are proven duplicates; keep the host value and remove only the
    // fragments Read Frog created.
    createdTails.forEach((tail) => tail.remove())
    return true
  }

  return false
}

export function disposeVirtualParagraphGroup(group: VirtualParagraphGroup): {
  restored: number
  skipped: number
} {
  if (group.status !== "active") return { restored: 0, skipped: 0 }

  group.status = "disposing"
  unregisterVirtualParagraphGroup(group)

  for (const wrapper of group.wrappers) {
    removeShadowHostInTranslatedWrapper(wrapper)
    markExtensionDrivenNodeRemoval(wrapper)
    wrapper.remove()
  }
  group.wrappers.clear()
  group.wrapperPlacements.clear()

  let restored = 0
  for (const record of group.splitRecords) {
    if (restoreTextSplit(record)) restored += 1
  }

  group.status = "disposed"
  return { restored, skipped: group.splitRecords.length - restored }
}

export function removeVirtualParagraphGroupForSource(source: HTMLElement): boolean {
  const group = getVirtualParagraphGroupForSource(source)
  if (!group) return false
  disposeVirtualParagraphGroup(group)
  return true
}

export function removeOrphanVirtualParagraphWrappers(source: HTMLElement): boolean {
  const orphanWrappers = [
    ...source.querySelectorAll<HTMLElement>(`[${VIRTUAL_PARAGRAPH_ATTRIBUTE}]`),
  ].filter((wrapper) => !getVirtualParagraphGroupForWrapper(wrapper))

  orphanWrappers.forEach((wrapper) => {
    removeShadowHostInTranslatedWrapper(wrapper)
    markExtensionDrivenNodeRemoval(wrapper)
    wrapper.remove()
  })
  return orphanWrappers.length > 0
}

export function dropVirtualParagraphWrapper(
  group: VirtualParagraphGroup,
  wrapper: HTMLElement,
): void {
  if (group.status !== "active" || !group.wrappers.has(wrapper)) return
  removeShadowHostInTranslatedWrapper(wrapper)
  unregisterVirtualParagraphWrapper(group, wrapper)
  markExtensionDrivenNodeRemoval(wrapper)
  wrapper.remove()
  if (group.wrappers.size === 0) disposeVirtualParagraphGroup(group)
}

export function removeVirtualParagraphWrapper(wrapper: HTMLElement): void {
  const group = getVirtualParagraphGroupForWrapper(wrapper)
  if (group) {
    dropVirtualParagraphWrapper(group, wrapper)
  } else {
    markExtensionDrivenNodeRemoval(wrapper)
    wrapper.remove()
  }
}

/**
 * Restore the original ChildNode objects a translationOnly wrapper displaced,
 * re-inserting the SAME nodes at the wrapper's position (node-identity restore).
 * Synchronous on purpose: the walker can issue several translate calls against
 * one parent in a single tick, and a deferred restore would let a later call
 * find a wrapper whose registry entry is already consumed.
 * @returns the original nodes this call re-inserted
 */
function restoreTranslationOnlyWrapper(wrapper: HTMLElement): ChildNode[] {
  const originals = takeTranslationOnlyOriginals(wrapper)
  if (!originals) {
    // Translation never completed (spinner / error UI / empty result), so the
    // originals were never removed — removing the wrapper IS the restore.
    wrapper.remove()
    return []
  }

  const parent = wrapper.parentNode
  if (!parent) {
    // The host rebuilt the region that owned the wrapper; never force stale
    // nodes back into a framework-rebuilt DOM.
    return []
  }

  const restored: ChildNode[] = []
  for (const node of originals) {
    if (node.isConnected) continue // the host re-attached this original itself
    parent.insertBefore(node, wrapper)
    restored.push(node)
  }
  wrapper.remove()

  // Restored originals may carry wrappers from an older walk (cross-walk
  // nesting); finish those restores so "show original" leaves no translation.
  for (const node of restored) {
    if (!isHTMLElement(node)) continue
    const nested = node.classList.contains(CONTENT_WRAPPER_CLASS)
      ? [node]
      : [...node.querySelectorAll<HTMLElement>(`.${CONTENT_WRAPPER_CLASS}`)]
    for (const nestedWrapper of nested) {
      if (nestedWrapper.isConnected) removeTranslatedWrapperWithRestore(nestedWrapper)
    }
  }
  return restored
}

function restoreSwapRecord(record: TranslationOnlySwapRecord): void {
  for (const item of record.items) {
    if (!item.node.isConnected) continue
    // The framework rewrote this node since we swapped it — its current value
    // is host-owned content; never clobber it with our stale original.
    if (item.node.data.trim() !== item.translatedValue.trim()) continue
    markExtensionDrivenCharacterData(item.node, item.originalValue)
    item.node.data = item.originalValue
  }
  for (const item of record.attributeItems) {
    if (!item.element.isConnected) continue
    if (item.element.getAttribute(item.name) !== item.translatedValue) continue
    if (item.originalValue === null) item.element.removeAttribute(item.name)
    else item.element.setAttribute(item.name, item.originalValue)
  }
}

function finalizeTranslationOnlyAnchorIfEmpty(state: TranslationOnlyAnchorState): void {
  if (state.swaps.length > 0) return
  for (const { name, previousValue } of state.attributeAdjustments) {
    if (previousValue === null) state.anchor.removeAttribute(name)
    else state.anchor.setAttribute(name, previousValue)
  }
  unregisterTranslationOnlyAnchorState(state.anchor)
}

/**
 * Drop an anchor's swap records touching the given nodes WITHOUT writing any
 * values back — used when the fallback wrapper strategy takes over a run whose
 * previous swap was already restored (the displaced nodes now belong to the
 * wrapper's node-identity registry).
 */
export function dropTranslationOnlySwapRecordsForNodes(
  anchor: HTMLElement,
  nodes: readonly ChildNode[],
): void {
  const state = getTranslationOnlyAnchorState(anchor)
  if (!state) return
  dropTranslationOnlySwapRecords(
    state,
    state.swaps.filter(
      (record) =>
        swapRecordIntersectsNodes(record, nodes) || isTranslationOnlySwapRecordDead(record),
    ),
  )
  finalizeTranslationOnlyAnchorIfEmpty(state)
}

/**
 * Undo in-place text swaps registered on an anchor. With `filterNodes`, only
 * swap records whose nodes intersect those nodes are restored (the walker
 * toggles one run at a time); without it, everything is restored.
 * `keepRecords` is the retranslation mode: values return to source but the
 * records stay registered (expected text refreshed) so the anchor keeps being
 * monitored through the provider round-trip — a dropped re-swap must not
 * leave the region untranslated AND unwatched. The incoming swap replaces the
 * kept records.
 * @returns true when at least one swap record was restored
 */
export function restoreTranslationOnlySwapsForAnchor(
  anchor: HTMLElement,
  filterNodes?: readonly ChildNode[],
  options?: { keepRecords?: boolean },
): boolean {
  const state = getTranslationOnlyAnchorState(anchor)
  if (!state) {
    // Stale marker from a previous content-script realm: the payload is gone,
    // so the marker is the only thing left to clean up.
    anchor.removeAttribute(TRANSLATION_ONLY_ATTRIBUTE)
    return false
  }

  // Records whose every node the host disconnected are unrestorable debris;
  // letting them linger would pin detached subtrees and hold the marker (and
  // the walker skip) forever.
  const deadRecords = state.swaps.filter(isTranslationOnlySwapRecordDead)
  dropTranslationOnlySwapRecords(state, deadRecords)

  const toRestore = state.swaps.filter(
    (record) => !filterNodes || swapRecordIntersectsNodes(record, filterNodes),
  )
  if (toRestore.length === 0) {
    finalizeTranslationOnlyAnchorIfEmpty(state)
    // Pruning emptied the anchor: the host rebuilt the translated content, so
    // a toggle pressing "hide" here has nothing left to hide — report the
    // clear so the caller flips OFF instead of translating the fresh content.
    return deadRecords.length > 0 && state.swaps.length === 0
  }

  toRestore.forEach(restoreSwapRecord)
  if (options?.keepRecords) {
    toRestore.forEach(refreshTranslationOnlySwapRecordExpectedText)
  } else {
    dropTranslationOnlySwapRecords(state, toRestore)
    finalizeTranslationOnlyAnchorIfEmpty(state)
  }
  return true
}

/**
 * Remove translated wrapper and restore original content based on translation mode
 * @param wrapper - The translated wrapper element to remove
 * @returns for translationOnly wrappers, the original nodes re-inserted by the restore
 */
export function removeTranslatedWrapperWithRestore(wrapper: HTMLElement): ChildNode[] {
  // Every path below removes the wrapper (directly or via restore).
  markExtensionDrivenNodeRemoval(wrapper)
  const virtualParagraphGroup = getVirtualParagraphGroupForWrapper(wrapper)
  if (virtualParagraphGroup) {
    disposeVirtualParagraphGroup(virtualParagraphGroup)
    return []
  }

  const bilingualState = getBilingualTranslationStateForWrapper(wrapper)
  if (bilingualState) unregisterBilingualTranslationState(bilingualState)

  removeShadowHostInTranslatedWrapper(wrapper)

  const translationMode = wrapper.getAttribute(TRANSLATION_MODE_ATTRIBUTE)

  if (translationMode === "translationOnly") {
    return restoreTranslationOnlyWrapper(wrapper)
  }

  wrapper.remove()
  return []
}

export function removeAllTranslatedWrapperNodes(root: Document | ShadowRoot = document): void {
  const isInsideRoot = (source: HTMLElement) =>
    root.nodeType === Node.DOCUMENT_NODE
      ? source.ownerDocument === root && source.isConnected
      : source.getRootNode() === root || root.contains(source)

  getPendingBilingualTranslationStates()
    .filter((state) => isInsideRoot(state.layoutSource))
    .forEach(unregisterBilingualTranslationState)
  getPendingVirtualParagraphGroups()
    .filter((group) => isInsideRoot(group.layoutSource))
    .forEach(disposeVirtualParagraphGroup)
  const translatedNodes = deepQueryTopLevelSelector(root, isTranslatedWrapperNode)
  translatedNodes.forEach((contentWrapperNode) => {
    removeTranslatedWrapperWithRestore(contentWrapperNode)
  })
  // In-place-swapped paragraphs have no wrapper; their anchors are found by
  // marker attribute. Collect ALL matches — nested anchors are independent.
  const swapAnchors = deepQueryAllSelector(root, (element) =>
    element.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE),
  )
  swapAnchors.forEach((anchor) => restoreTranslationOnlySwapsForAnchor(anchor))
}
