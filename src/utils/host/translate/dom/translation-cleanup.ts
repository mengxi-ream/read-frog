import type { TextSplitRecord, VirtualParagraphGroup } from "../core/translation-state"
import {
  REACT_SHADOW_HOST_CLASS,
  SPINNER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  VIRTUAL_PARAGRAPH_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { removeReactShadowHost } from "../../../react-shadow-host/create-shadow-host"
import { batchDOMOperation } from "../../dom/batch-dom"
import { isHTMLElement, isTranslatedWrapperNode } from "../../dom/filter"
import { deepQueryTopLevelSelector } from "../../dom/find"
import {
  getBilingualTranslationStateForWrapper,
  getPendingBilingualTranslationStates,
  getPendingVirtualParagraphGroups,
  getVirtualParagraphGroupForSource,
  getVirtualParagraphGroupForWrapper,
  markExtensionDrivenNodeRemoval,
  originalContentMap,
  unregisterBilingualTranslationState,
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
 * Remove translated wrapper and restore original content based on translation mode
 * @param wrapper - The translated wrapper element to remove
 */
export function removeTranslatedWrapperWithRestore(wrapper: HTMLElement): void {
  // Every path below removes the wrapper (directly or via an innerHTML restore).
  markExtensionDrivenNodeRemoval(wrapper)
  const virtualParagraphGroup = getVirtualParagraphGroupForWrapper(wrapper)
  if (virtualParagraphGroup) {
    disposeVirtualParagraphGroup(virtualParagraphGroup)
    return
  }

  const bilingualState = getBilingualTranslationStateForWrapper(wrapper)
  if (bilingualState) unregisterBilingualTranslationState(bilingualState)

  removeShadowHostInTranslatedWrapper(wrapper)

  const translationMode = wrapper.getAttribute(TRANSLATION_MODE_ATTRIBUTE)

  if (translationMode === "translationOnly") {
    // For translation-only mode, find nearest ancestor in originalContentMap and restore
    let currentNode = wrapper.parentNode

    while (currentNode && isHTMLElement(currentNode)) {
      const originalContent = originalContentMap.get(currentNode)
      if (originalContent) {
        const nodeToRestore = currentNode
        batchDOMOperation(() => {
          nodeToRestore.innerHTML = originalContent
        })
        originalContentMap.delete(currentNode)
        return
      }
      currentNode = currentNode.parentNode
    }
  }

  if (translationMode === "bilingual") {
    wrapper.remove()
    return
  }

  // When no original content is found, just remove the wrapper.
  batchDOMOperation(() => wrapper.remove())
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
}
