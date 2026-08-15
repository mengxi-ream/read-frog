import { CONTENT_WRAPPER_CLASS, TRANSLATION_ONLY_ATTRIBUTE } from "@/utils/constants/dom-labels"
import { getPageTranslationSessionId } from "../translation-session"
import { ensureSiteRuleCSS, removeSiteRuleCSS } from "./style-injector"

type StyleRoot = Document | ShadowRoot

const VISIBLE_TRANSLATION_SELECTOR =
  `.${CONTENT_WRAPPER_CLASS},[${TRANSLATION_ONLY_ATTRIBUTE}]` as const

interface NodeSiteRuleCSSState {
  cssText: string
  observer: MutationObserver
  pendingOperations: number
}

const nodeSiteRuleCSSStates = new WeakMap<StyleRoot, NodeSiteRuleCSSState>()

function pageTranslationOwnsCSS(root: StyleRoot): boolean {
  return root instanceof Document && getPageTranslationSessionId() !== null
}

function hasVisibleTranslation(root: StyleRoot): boolean {
  return root.querySelector(VISIBLE_TRANSLATION_SELECTOR) !== null
}

function removedNodeContainsTranslation(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const element = node as Element
  return (
    element.matches(VISIBLE_TRANSLATION_SELECTOR) ||
    element.querySelector(VISIBLE_TRANSLATION_SELECTOR) !== null
  )
}

function mayHaveRemovedTranslation(records: MutationRecord[]): boolean {
  return records.some((record) => {
    if (record.type === "attributes") return true
    return [...record.removedNodes].some(removedNodeContainsTranslation)
  })
}

function disposeState(root: StyleRoot, state: NodeSiteRuleCSSState): void {
  if (nodeSiteRuleCSSStates.get(root) !== state) return
  state.observer.disconnect()
  nodeSiteRuleCSSStates.delete(root)
  removeSiteRuleCSS(root)
}

function cleanupIfUnused(root: StyleRoot, state: NodeSiteRuleCSSState): void {
  if (
    nodeSiteRuleCSSStates.get(root) !== state ||
    state.pendingOperations > 0 ||
    pageTranslationOwnsCSS(root) ||
    hasVisibleTranslation(root)
  ) {
    return
  }
  disposeState(root, state)
}

function createState(root: StyleRoot, cssText: string): NodeSiteRuleCSSState {
  let state: NodeSiteRuleCSSState
  const observer = new MutationObserver((records) => {
    if (mayHaveRemovedTranslation(records)) cleanupIfUnused(root, state)
  })
  state = { cssText, observer, pendingOperations: 0 }
  nodeSiteRuleCSSStates.set(root, state)
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [TRANSLATION_ONLY_ATTRIBUTE],
  })
  return state
}

/**
 * Retain per-site CSS for one node-translation operation. The returned release
 * function must be awaited in a finally block so overlapping operations cannot
 * remove their shared stylesheet while another translation is still pending.
 */
export async function beginNodeSiteRuleCSSOperation(
  root: StyleRoot,
  cssText: string | null,
): Promise<() => Promise<void>> {
  let state = nodeSiteRuleCSSStates.get(root)
  if (!state) {
    if (!cssText) return async () => {}
    state = createState(root, cssText)
  }
  state.pendingOperations += 1

  if (cssText) {
    state.cssText = cssText
    try {
      await ensureSiteRuleCSS(root, cssText)
    } catch (error) {
      state.pendingOperations -= 1
      cleanupIfUnused(root, state)
      throw error
    }
  }

  let released = false
  return async () => {
    if (released) return
    released = true
    state.pendingOperations -= 1

    if (state.pendingOperations > 0 || pageTranslationOwnsCSS(root)) return
    if (hasVisibleTranslation(root)) {
      // A page-session stop or an overlapping operation may have removed the
      // shared stylesheet while this operation was awaiting translation.
      await ensureSiteRuleCSS(root, state.cssText)
      return
    }
    disposeState(root, state)
  }
}

/** Reconcile node-owned CSS after a page session synchronously removes wrappers. */
export function cleanupNodeSiteRuleCSSIfUnused(root: StyleRoot): void {
  const state = nodeSiteRuleCSSStates.get(root)
  if (state) cleanupIfUnused(root, state)
}
