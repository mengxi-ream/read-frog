import type { TextSplitRecord, VirtualParagraphGroup } from "../core/translation-state"
import {
  REACT_SHADOW_HOST_CLASS,
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

  // Remove lightweight spinners
  const spinner = wrapper.querySelector(".read-frog-spinner")
  spinner?.remove()
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
  if (!source.isConnected || source.parentNode !== parent) return false

  let previous: Text = source
  for (const tail of createdTails) {
    if (!tail.isConnected || tail.parentNode !== parent || previous.nextSibling !== tail) {
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

  const tailsAreUnchanged = createdTails.every(
    (tail, index) => tail.data === tailValuesAfterSplit[index],
  )
  const hostReconstructedFullText =
    source.data !== sourceValueAfterSplit && source.data.startsWith(originalValue)
  if (tailsAreUnchanged && hostReconstructedFullText) {
    // Frameworks such as React can update their original Text node with the
    // complete expanded value while leaving splitText-created tails behind.
    // The unchanged tails are then proven duplicates; keep the host value and
    // remove only the fragments Read Frog created.
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
  wrapper.remove()
  if (group.wrappers.size === 0) disposeVirtualParagraphGroup(group)
}

export function removeVirtualParagraphWrapper(wrapper: HTMLElement): void {
  const group = getVirtualParagraphGroupForWrapper(wrapper)
  if (group) dropVirtualParagraphWrapper(group, wrapper)
  else wrapper.remove()
}

/**
 * Remove translated wrapper and restore original content based on translation mode
 * @param wrapper - The translated wrapper element to remove
 */
export function removeTranslatedWrapperWithRestore(wrapper: HTMLElement): void {
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
