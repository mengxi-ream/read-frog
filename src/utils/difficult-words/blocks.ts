import { isInlineDisplay, isSkippedSubtree } from "@/utils/annotate/text-offsets"

// The paragraphs words are marked in. A block is an element that lays out its
// own lines, and its text is the text nodes it holds itself: a paragraph
// nested inside it is a block of its own, not part of its text. Where a
// nested block, a skipped element or a line break interrupts the text, a
// line break stands in for it, so the words on either side stay apart.

/** Not prose to read: code, form controls, formulas and graphics. */
const SCAN_SKIPPED_NAMES = new Set([
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "textarea",
  "input",
  "select",
  "option",
  "button",
  "svg",
  "math",
])

/** Whether `element` and everything in it are left out of the scan. */
export function isScanSkipped(element: Element): boolean {
  return (
    isSkippedSubtree(element) ||
    SCAN_SKIPPED_NAMES.has(element.localName) ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

/** Whether `node` sits inside something the scan leaves out. */
export function isInScanSkippedSubtree(node: Node): boolean {
  for (let element = node.parentElement; element; element = element.parentElement) {
    if (isScanSkipped(element)) return true
  }
  return false
}

/**
 * Finds the block each element's text belongs to, remembering the answer for
 * every element on the way up: a page's text nodes share few ancestors, so a
 * whole page costs about one style read per element.
 */
export class BlockResolver {
  private cache = new WeakMap<Element, Element | null>()

  blockOf(element: Element): Element | null {
    const path: Element[] = []
    let block: Element | null = null
    for (
      let current: Element | null = element;
      current && current !== current.ownerDocument.documentElement;
      current = current.parentElement
    ) {
      const cached = this.cache.get(current)
      if (cached !== undefined) {
        block = cached
        break
      }
      path.push(current)
      if (!isInlineDisplay(getComputedStyle(current).display)) {
        block = current
        break
      }
    }
    for (const visited of path) this.cache.set(visited, block)
    return block
  }

  /** Forget what was found under `root`: its elements may have moved or changed display. */
  forget(root: Element) {
    this.cache.delete(root)
    for (const element of root.querySelectorAll("*")) this.cache.delete(element)
  }
}

export interface BlockText {
  /** The block's own text, a line break where it is interrupted. */
  text: string
  nodes: Text[]
  /** Where each of `nodes` starts in `text`. */
  offsets: number[]
}

/** A walker over `root`'s text nodes and line breaks, skipping what is not read. */
function createScanWalker(root: Node, onSkipped?: () => void) {
  return document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Element) {
        if (isScanSkipped(node)) {
          onSkipped?.()
          return NodeFilter.FILTER_REJECT
        }
        return node.localName === "br" ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })
}

export function readBlockText(block: Element, resolver: BlockResolver): BlockText {
  let text = ""
  const nodes: Text[] = []
  const offsets: number[] = []
  let interrupted = false
  const walker = createScanWalker(block, () => {
    interrupted = true
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) {
      interrupted = true
      continue
    }
    const textNode = node as Text
    const parent = textNode.parentElement
    if (!parent || resolver.blockOf(parent) !== block) {
      interrupted = true
      continue
    }
    if (interrupted && text !== "") text += "\n"
    interrupted = false
    offsets.push(text.length)
    nodes.push(textNode)
    text += textNode.data
  }
  return { text, nodes, offsets }
}

// The node holding the character at `offset`: offsets are ascending.
function nodeIndexAt(blockText: BlockText, offset: number): number {
  let low = 0
  let high = blockText.offsets.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (blockText.offsets[middle]! <= offset) low = middle
    else high = middle - 1
  }
  return low
}

/** A Range over `[start, end)` of the block's text, or `null` when it falls outside its nodes. */
export function rangeForSpan(blockText: BlockText, start: number, end: number): Range | null {
  if (blockText.nodes.length === 0 || start < 0 || end <= start || end > blockText.text.length) {
    return null
  }
  const startIndex = nodeIndexAt(blockText, start)
  const endIndex = nodeIndexAt(blockText, end - 1)
  const startNode = blockText.nodes[startIndex]!
  const endNode = blockText.nodes[endIndex]!
  const startOffset = start - blockText.offsets[startIndex]!
  const endOffset = end - blockText.offsets[endIndex]!
  // A span on a line break stood in for an interruption, not on a node.
  if (startOffset >= startNode.length || endOffset > endNode.length) return null
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  return range
}

/**
 * The blocks under `root` with text to read, in document order, found in
 * slices of the main thread: `shouldYield` says when a slice is used up, and
 * the walk resumes on the next call. A walk the page pulled the ground from
 * under (its current node left the document) starts over, skipping the text
 * already seen.
 */
export class BlockDiscovery {
  private walker: TreeWalker
  private readonly seen = new WeakSet<Text>()
  private done = false

  constructor(
    private readonly root: Element,
    private readonly resolver: BlockResolver,
  ) {
    this.walker = createScanWalker(root)
  }

  get finished() {
    return this.done
  }

  /**
   * Walks until `shouldYield` says stop or the walk ends, calling `onBlock`
   * with the block of each text node not seen before: a block holding several
   * comes once for each.
   */
  run(shouldYield: () => boolean, onBlock: (block: Element) => void) {
    if (this.done) return
    if (!this.walker.currentNode.isConnected) {
      this.walker = createScanWalker(this.root)
    }
    while (!shouldYield()) {
      const node = this.walker.nextNode()
      if (!node) {
        this.done = true
        return
      }
      if (node instanceof Element || this.seen.has(node as Text)) continue
      const textNode = node as Text
      this.seen.add(textNode)
      if (!/\S/.test(textNode.data) || !textNode.parentElement) continue
      const block = this.resolver.blockOf(textNode.parentElement)
      if (block) onBlock(block)
    }
  }
}

/** The blocks with text under `root` (itself included), for content the page just added. */
export function findBlocksIn(root: Node, resolver: BlockResolver): Set<Element> {
  const blocks = new Set<Element>()
  if (root instanceof Text) {
    if (/\S/.test(root.data) && root.parentElement && !isInScanSkippedSubtree(root)) {
      const block = resolver.blockOf(root.parentElement)
      if (block) blocks.add(block)
    }
    return blocks
  }
  if (!(root instanceof Element) || isScanSkipped(root) || isInScanSkippedSubtree(root)) {
    return blocks
  }
  const walker = createScanWalker(root)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) continue
    const textNode = node as Text
    if (!/\S/.test(textNode.data) || !textNode.parentElement) continue
    const block = resolver.blockOf(textNode.parentElement)
    if (block) blocks.add(block)
  }
  return blocks
}

/** The block's language as the page declares it, when it is usable as a hint. */
export function getLanguageHint(block: Element): string | undefined {
  const hint = block.closest("[lang]")?.getAttribute("lang")?.trim()
  return hint && hint.length <= 35 ? hint : undefined
}
