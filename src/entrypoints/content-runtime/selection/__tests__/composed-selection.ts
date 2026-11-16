import type { SelectionRangeSnapshot } from "../utils"
import { vi } from "vitest"

function getShadowIncludingParent(node: Node) {
  return node instanceof ShadowRoot ? node.host : node.parentNode
}

function isShadowIncludingInclusiveAncestor(ancestor: Node, node: Node) {
  for (let current: Node | null = node; current; current = getShadowIncludingParent(current)) {
    if (current === ancestor) {
      return true
    }
  }
  return false
}

// Where getComposedRanges() puts a boundary: one inside a shadow root it wasn't
// handed (nor a shadow-including ancestor of one it was) moves out to just
// before (start) or just after (end) the host, until it reaches a tree it may
// stay in.
// https://w3c.github.io/selection-api/#dom-selection-getcomposedranges
function rescopeBoundary(
  node: Node,
  offset: number,
  shadowRoots: ShadowRoot[],
  side: "start" | "end",
) {
  for (;;) {
    const root = node.getRootNode()
    if (
      !(root instanceof ShadowRoot) ||
      shadowRoots.some((shadowRoot) => isShadowIncludingInclusiveAncestor(root, shadowRoot))
    ) {
      return { node, offset }
    }

    const parent = root.host.parentNode
    if (!parent) {
      throw new Error("Shadow host is detached")
    }
    offset = Array.prototype.indexOf.call(parent.childNodes, root.host) + (side === "end" ? 1 : 0)
    node = parent
  }
}

/**
 * A selection that starts or ends inside a shadow root, as Chrome reports it.
 * The legacy API (anchorNode, getRangeAt, isCollapsed) sees it collapsed in
 * front of the outermost host and only `type` says otherwise, toString() gives
 * `browserText`, and getComposedRanges() follows the spec.
 */
export function createShadowSelection(range: SelectionRangeSnapshot, browserText: string) {
  const legacy = rescopeBoundary(range.startContainer, range.startOffset, [], "start")
  const legacyRange = document.createRange()
  legacyRange.setStart(legacy.node, legacy.offset)
  legacyRange.collapse(true)

  const getComposedRanges = vi.fn<
    (options?: { shadowRoots?: ShadowRoot[] }) => SelectionRangeSnapshot[]
  >(({ shadowRoots = [] } = {}) => {
    const start = rescopeBoundary(range.startContainer, range.startOffset, shadowRoots, "start")
    const end = rescopeBoundary(range.endContainer, range.endOffset, shadowRoots, "end")
    return [
      {
        startContainer: start.node,
        startOffset: start.offset,
        endContainer: end.node,
        endOffset: end.offset,
      },
    ]
  })

  const selection = {
    type: "Range",
    isCollapsed: true,
    rangeCount: 1,
    anchorNode: legacy.node,
    anchorOffset: legacy.offset,
    focusNode: legacy.node,
    focusOffset: legacy.offset,
    toString: () => browserText,
    getRangeAt: () => legacyRange,
    containsNode: () => false,
    getComposedRanges,
  } as unknown as Selection

  return { selection, getComposedRanges }
}
