import {
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  REACT_SHADOW_HOST_CLASS,
} from "@/utils/constants/dom-labels"

// An annotation is kept as offsets into its block's text, and this file is
// the one definition of that text: the block's text nodes in document order,
// minus what is not the page's own prose — scripts, furigana, and everything
// the extension itself put in the block. Skipping the extension's own nodes
// is what keeps the offsets stable when page translation inserts a
// translation under the paragraph.

const SKIPPED_ELEMENT_NAMES = new Set(["script", "style", "noscript", "template", "rt", "rp"])

/** The display values an element can have and still be part of a line. */
function isInlineDisplay(display: string) {
  return (
    display === "inline" ||
    display === "contents" ||
    display === "none" ||
    display.startsWith("ruby")
  )
}

/** Whether `element` and everything in it are left out of the block's text. */
export function isSkippedSubtree(element: Element): boolean {
  return (
    SKIPPED_ELEMENT_NAMES.has(element.localName) ||
    element.classList.contains(CONTENT_WRAPPER_CLASS) ||
    element.classList.contains(REACT_SHADOW_HOST_CLASS) ||
    (element.classList.contains(NOTRANSLATE_CLASS) && element.hasAttribute("translate"))
  )
}

function createTextWalker(root: Node) {
  return document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Element) {
        return isSkippedSubtree(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
}

/** The block's text nodes, in order, as the offsets count them. */
export function collectTextNodes(block: Node): Text[] {
  const nodes: Text[] = []
  const walker = createTextWalker(block)
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  return nodes
}

export function firstTextNode(block: Node): Text | null {
  for (const node of collectTextNodes(block)) {
    if (node.data.trim() !== "") return node
  }
  return null
}

/** The block's text, exactly as the offsets index it: no normalisation. */
export function getBlockText(block: Node): string {
  return collectTextNodes(block)
    .map((node) => node.data)
    .join("")
}

/**
 * The block an annotation belongs to: the nearest ancestor that lays out its
 * own lines. `null` for text the extension put there itself, and for text
 * with no such ancestor (a bare shadow root).
 */
export function findAnnotationBlock(node: Node | null): Element | null {
  let element: Element | null = node instanceof Element ? node : (node?.parentElement ?? null)
  while (element && element !== element.ownerDocument.documentElement) {
    if (isSkippedSubtree(element)) return null
    if (!isInlineDisplay(getComputedStyle(element).display)) return element
    element = element.parentElement
  }
  return null
}

/** Whether a point in the document sits in a translation the extension inserted. */
export function isInsideTranslatedContent(node: Node | null): boolean {
  const element = node instanceof Element ? node : (node?.parentElement ?? null)
  return element?.closest(`.${CONTENT_WRAPPER_CLASS}`) !== null && element !== null
}

export interface TextOffsets {
  start: number
  end: number
}

// -1, 0 or 1 as the point (node, offset) comes before, at or after `point`.
function comparePoint(point: Range, node: Node, offset: number): number {
  const probe = document.createRange()
  probe.setStart(node, offset)
  probe.collapse(true)
  return probe.compareBoundaryPoints(Range.START_TO_START, point)
}

// Where `point` falls in the block's text, as an offset, or `null` when it is
// past the last text node. A point between two text nodes (an element
// boundary) is the offset of the next one.
function offsetOfPoint(nodes: Text[], point: Range): number | null {
  let offset = 0
  for (const node of nodes) {
    if (comparePoint(point, node, node.length) < 0) {
      offset += node.length
      continue
    }
    if (comparePoint(point, node, 0) >= 0) {
      return offset
    }
    // Inside this node: the comparison is monotonic in the offset, so bisect.
    let low = 0
    let high = node.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (comparePoint(point, node, middle) < 0) {
        low = middle + 1
      } else {
        high = middle
      }
    }
    return offset + low
  }
  return null
}

/** The offsets of `range` in `block`'s text, or `null` when it is not inside it. */
export function rangeToOffsets(block: Node, range: Range): TextOffsets | null {
  const nodes = collectTextNodes(block)
  if (nodes.length === 0) return null

  let startPoint: Range
  let endPoint: Range
  try {
    startPoint = range.cloneRange()
    startPoint.collapse(true)
    endPoint = range.cloneRange()
    endPoint.collapse(false)
  } catch {
    return null
  }

  try {
    const total = nodes.reduce((sum, node) => sum + node.length, 0)
    const start = offsetOfPoint(nodes, startPoint) ?? total
    const end = offsetOfPoint(nodes, endPoint) ?? total
    return start < end ? { start, end } : null
  } catch {
    // compareBoundaryPoints throws for points in another tree (a shadow root).
    return null
  }
}

/** A live Range over `[start, end)` of `block`'s text, or `null` when out of range. */
export function offsetsToRange(block: Node, start: number, end: number): Range | null {
  if (start < 0 || end <= start) return null
  const range = document.createRange()
  let offset = 0
  let startSet = false
  for (const node of collectTextNodes(block)) {
    const next = offset + node.length
    if (!startSet && start < next) {
      range.setStart(node, start - offset)
      startSet = true
    }
    if (startSet && end <= next) {
      range.setEnd(node, end - offset)
      return range
    }
    offset = next
  }
  return null
}

/**
 * Where `surface` is in `text` now, nearest to where it was: a page that
 * edited the text around an annotation moved it, not removed it. `null` when
 * it is nowhere.
 */
export function findNearestOccurrence(text: string, surface: string, near: number): number | null {
  if (surface === "") return null
  let best: number | null = null
  let from = 0
  while (from <= text.length) {
    const index = text.indexOf(surface, from)
    if (index === -1) break
    if (best === null || Math.abs(index - near) < Math.abs(best - near)) best = index
    if (index > near) break
    from = index + 1
  }
  return best
}
