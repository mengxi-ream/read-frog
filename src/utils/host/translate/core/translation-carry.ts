import type { TranslationMode } from "@/types/config/translate"
import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_CONTENT_CLASS,
  PARAGRAPH_ATTRIBUTE,
  REACT_SHADOW_HOST_CLASS,
  SPINNER_CLASS,
  TRANSLATION_ERROR_CONTAINER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  VIRTUAL_PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { isHTMLElement, isTranslatedWrapperNode } from "../../dom/filter"
import {
  getBilingualTranslationStateForWrapper,
  getVirtualParagraphGroupForWrapper,
  rebindBilingualTranslationState,
} from "./translation-state"

interface WrapperPlacement {
  wrapper: HTMLElement
  parent: Node
  before: Node | null
}

/**
 * React 19 re-applies `dangerouslySetInnerHTML` on every re-render of its host
 * element (the `{ __html }` prop is compared by identity, and callers build a
 * new object per render), so CMS rich-text pages replace a translated subtree
 * with an identical copy whenever any ancestor re-renders. Retranslating the
 * copy takes a few frames, and the height it loses meanwhile is a scroll
 * anchoring shift. isc2.org articles re-render on every scroll-direction
 * change, so near the end of the page each shift caused the next rewrite: the
 * last paragraphs were wiped and retranslated ~30 times a second.
 *
 * This runs in the MutationObserver callback, so in the same task as the
 * rewrite and before layout. When the new children are an exact copy of the
 * removed ones (same tags and text; attributes and our wrappers ignored), each
 * finished bilingual wrapper moves to the matching place in the copy and its
 * state is re-keyed to the copied source. Layout never sees the rewrite, and
 * the walk that follows skips the copied paragraphs because they already hold
 * a wrapper.
 *
 * All or nothing per translation unit: a wrapper that is pending, failed,
 * translationOnly or part of a virtual paragraph group stays behind, and so do
 * the other wrappers of its unit, which then retranslates as before. Moving
 * only some would strand the rest, because the walk never translates a unit
 * that already holds a wrapper.
 */
export function carryTranslationsAcrossRewrite(record: MutationRecord, walkId: string): void {
  const target = record.target
  if (record.type !== "childList" || !target.isConnected) return
  const removed = [...record.removedNodes]
  const added = [...record.addedNodes]
  if (added.length === 0 || !removed.some(containsTranslatedWrapper)) return

  // Only a full replacement (innerHTML, replaceChildren) tells us the removed
  // nodes were the target's whole previous content, so positions line up.
  const current = target.childNodes
  if (current.length !== added.length || added.some((node, index) => current[index] !== node)) {
    return
  }

  const copies = new Map<Node, Node>()
  const placements: WrapperPlacement[] = []
  if (!matchChildren(removed, added, target, copies, placements)) return

  const blockedUnits = new Set<Node>()
  for (const { wrapper } of placements) {
    if (!isCarryableWrapper(wrapper, walkId, target, copies)) {
      blockedUnits.add(findTranslationUnit(wrapper))
    }
  }
  const carried = placements.filter(
    ({ wrapper }) => !blockedUnits.has(findTranslationUnit(wrapper)),
  )

  for (const { wrapper, parent, before } of carried) {
    parent.insertBefore(wrapper, before)
  }
  for (const { wrapper } of carried) {
    const state = getBilingualTranslationStateForWrapper(wrapper)
    const copiedSource = state && copies.get(state.layoutSource)
    if (state && copiedSource && isHTMLElement(copiedSource)) {
      rebindBilingualTranslationState(state, copiedSource)
    }
  }
}

/**
 * The outermost labeled paragraph around a wrapper in the removed (detached)
 * subtree. The walk over the copy observes units no coarser than these, so a
 * unit's wrappers move or stay together. A wrapper with no labeled ancestor is
 * its own unit: the walk never revisits the rewritten target itself.
 */
function findTranslationUnit(wrapper: HTMLElement): Node {
  let unit: Node = wrapper
  for (let node = wrapper.parentElement; node; node = node.parentElement) {
    if (node.hasAttribute(PARAGRAPH_ATTRIBUTE)) unit = node
  }
  return unit
}

function containsTranslatedWrapper(node: Node): boolean {
  return (
    isTranslatedWrapperNode(node) ||
    (isHTMLElement(node) && node.querySelector(`.${CONTENT_WRAPPER_CLASS}`) !== null)
  )
}

/**
 * Pairs `oldChildren` (our wrappers skipped) with `newChildren` one to one and
 * records where each skipped wrapper goes: before the copy of the next host
 * node, or at the end of `newParent`.
 */
function matchChildren(
  oldChildren: Node[],
  newChildren: Node[],
  newParent: Node,
  copies: Map<Node, Node>,
  placements: WrapperPlacement[],
): boolean {
  let index = 0
  let pendingWrappers: HTMLElement[] = []
  for (const oldChild of oldChildren) {
    if (isTranslatedWrapperNode(oldChild)) {
      pendingWrappers.push(oldChild as HTMLElement)
      continue
    }
    const newChild = newChildren[index++]
    if (!newChild || !matchNode(oldChild, newChild, copies, placements)) return false
    for (const wrapper of pendingWrappers) {
      placements.push({ wrapper, parent: newParent, before: newChild })
    }
    pendingWrappers = []
  }
  if (index !== newChildren.length) return false
  for (const wrapper of pendingWrappers) {
    placements.push({ wrapper, parent: newParent, before: null })
  }
  return true
}

function matchNode(
  oldNode: Node,
  newNode: Node,
  copies: Map<Node, Node>,
  placements: WrapperPlacement[],
): boolean {
  if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) return false
  if (oldNode.nodeType !== Node.ELEMENT_NODE) return oldNode.nodeValue === newNode.nodeValue
  // Spinners and error hosts live inside wrappers; one outside is not ours to place.
  if (
    isHTMLElement(oldNode) &&
    (oldNode.classList.contains(SPINNER_CLASS) ||
      oldNode.classList.contains(REACT_SHADOW_HOST_CLASS))
  ) {
    return false
  }
  copies.set(oldNode, newNode)
  return matchChildren(
    [...oldNode.childNodes],
    [...newNode.childNodes],
    newNode,
    copies,
    placements,
  )
}

function isCarryableWrapper(
  wrapper: HTMLElement,
  walkId: string,
  target: Node,
  copies: Map<Node, Node>,
): boolean {
  if (
    wrapper.getAttribute(TRANSLATION_MODE_ATTRIBUTE) !== ("bilingual" satisfies TranslationMode) ||
    wrapper.getAttribute(WALKED_ATTRIBUTE) !== walkId ||
    wrapper.hasAttribute(VIRTUAL_PARAGRAPH_ATTRIBUTE) ||
    getVirtualParagraphGroupForWrapper(wrapper) !== undefined ||
    // Still waiting for the provider, or showing an error.
    wrapper.querySelector(
      `.${SPINNER_CLASS}, .${REACT_SHADOW_HOST_CLASS}, .${TRANSLATION_ERROR_CONTAINER_CLASS}`,
    ) !== null ||
    wrapper.querySelector(`.${INLINE_CONTENT_CLASS}, .${BLOCK_CONTENT_CLASS}`) === null
  ) {
    return false
  }

  const state = getBilingualTranslationStateForWrapper(wrapper)
  // Text-node runs have no state: their pipeline only checks that the wrapper
  // is still connected, which the move keeps true.
  if (!state) return true
  return (
    state.status === "active" &&
    state.walkId === walkId &&
    state.wrapperTextContent !== null &&
    wrapper.textContent === state.wrapperTextContent &&
    // The source was either copied too, or encloses the rewritten target.
    (copies.has(state.layoutSource) || state.layoutSource.contains(target))
  )
}
