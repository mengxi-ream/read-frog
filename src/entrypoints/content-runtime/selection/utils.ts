import { browser } from "#imports"
import { ANNOTATION_HOST_ATTRIBUTE } from "@/utils/annotate/styles"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { PROTECTED_HOST_ATTRIBUTE } from "@/utils/select-all"

export interface SelectionRangeSnapshot {
  startContainer: Node
  startOffset: number
  endContainer: Node
  endOffset: number
}

export interface TextControlSelectionSnapshot {
  value: string
  /** Null for input types without a selection API (e.g. email). */
  selectionStart: number | null
  selectionEnd: number | null
}

export interface SelectionSnapshot {
  text: string
  ranges: SelectionRangeSnapshot[]
  /**
   * Set when the selection is inside an `<input>`/`<textarea>`. Their text lives
   * in the control's value, which the DOM ranges can't reach (Chrome reports
   * them around the control element), so context is built from this instead.
   */
  textControl?: TextControlSelectionSnapshot
  /**
   * Set for a selection relayed from another frame (the ebook reader), which
   * has no ranges in this one: where it ended, in this frame's viewport.
   */
  anchor?: { x: number; y: number }
}

export interface ContextSnapshot {
  text: string
  paragraphs: string[]
}

type SelectionRangeSource = SelectionRangeSnapshot

type ParagraphOwner = Element

const ZERO_WIDTH_CHAR_REGEX = /\u200B/g
const WHITESPACE_REGEX = /\s+/g
const PARAGRAPH_SEPARATOR = "\n\n"
const TEXT_CONTROL_PARAGRAPH_BREAK_REGEX = /(\n[^\S\n]*\n)/
// Password fields are deliberately absent: their value must never reach a prompt.
const TEXT_CONTROL_INPUT_TYPES = new Set(["email", "search", "tel", "text", "url"])
// Text inside these is never rendered as page content: a textarea's is only its
// default value, an SVG's description and metadata are for tools, and a frame,
// canvas, select box, meter or media element shows something else in place of
// what it holds. So it must not leak into the selected text or paragraph context.
// A field's value is read only for a selection in it, never a password's, so
// its inner shadow root stays out too should a browser ever show it.
const NON_CONTENT_ELEMENT_NAMES = new Set([
  "audio",
  "canvas",
  "desc",
  "head",
  "iframe",
  "input",
  "metadata",
  "meter",
  "noscript",
  "progress",
  "script",
  "select",
  "style",
  "template",
  "textarea",
  "title",
  "video",
])
// Furigana (<rt>) and its fallback parentheses (<rp>). The browser's selection
// text reads them alongside the base text (漢字かんじ), so speech says each word
// twice and translation gets the reading as noise. Page translation skips them
// for the same reason (DONT_WALK_AND_TRANSLATE_TAGS).
const RUBY_ANNOTATION_ELEMENT_NAMES = new Set(["rp", "rt"])
const RUBY_ANNOTATION_SELECTOR = "rp, rt"
// Read Frog's own UI, by the marks Read Frog puts on its shadow hosts: the
// selection toolbar and side panel, the annotation layer, and the React hosts
// of page translation, subtitles and the diagnosis panel. Not by the
// notranslate class, which pages put on their own text too.
const READ_FROG_UI_HOST_SELECTOR = `[${PROTECTED_HOST_ATTRIBUTE}], [${ANNOTATION_HOST_ATTRIBUTE}], .${REACT_SHADOW_HOST_CLASS}`
const NON_NEWLINE_WHITESPACE_REGEX = /[^\S\n]+/g
const LEADING_SPACES_REGEX = /^ +/
const TRAILING_SPACES_REGEX = / +$/
const ENDS_WITH_COLLAPSED_SPACE_REGEX = /[ \n]$/
// white-space values that render every space written in the source.
const SPACE_PRESERVING_WHITE_SPACE = new Set(["break-spaces", "pre", "pre-wrap"])
const PARAGRAPH_LIKE_TAGS = new Set([
  "P",
  "LI",
  "TD",
  "TH",
  "DT",
  "DD",
  "BLOCKQUOTE",
  "PRE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "FIGCAPTION",
])
const SEMANTIC_CONTAINER_TAGS = new Set(["ARTICLE", "ASIDE", "BODY", "MAIN", "NAV", "SECTION"])
// Boxes that the browser's selection text puts on lines of their own. Inline-level
// ones (inline-block, inline-flex) share the line. The browser puts a tab between
// table cells, but a line break keeps their words apart as well.
const PARAGRAPH_DISPLAY_VALUES = new Set([
  "block",
  "flow-root",
  "list-item",
  "flex",
  "grid",
  "-webkit-box",
  "table",
  "table-caption",
  "table-row",
  "table-cell",
])

export function normalizeSelectedText(value: string | null | undefined) {
  return value?.replace(ZERO_WIDTH_CHAR_REGEX, "").trim() ?? ""
}

function normalizeParagraphText(value: string) {
  return value.replace(ZERO_WIDTH_CHAR_REGEX, "").replace(WHITESPACE_REGEX, " ").trim()
}

export function createRangeSnapshot(rangeSource: SelectionRangeSource): SelectionRangeSnapshot {
  return {
    startContainer: rangeSource.startContainer,
    startOffset: rangeSource.startOffset,
    endContainer: rangeSource.endContainer,
    endOffset: rangeSource.endOffset,
  }
}

function isInOneTree({ startContainer, endContainer }: SelectionRangeSnapshot) {
  return startContainer.getRootNode() === endContainer.getRootNode()
}

// A live Range sits in one tree. setEnd() would collapse one whose boundaries
// are in different shadow trees, so refuse instead of handing back an empty range.
export function toLiveRange(rangeSnapshot: SelectionRangeSnapshot) {
  if (!isInOneTree(rangeSnapshot)) {
    throw new Error("A live Range can't span shadow roots")
  }

  const range = document.createRange()
  range.setStart(rangeSnapshot.startContainer, rangeSnapshot.startOffset)
  range.setEnd(rangeSnapshot.endContainer, rangeSnapshot.endOffset)
  return range
}

function getParentNodeAcrossShadow(node: Node | null) {
  if (!node) {
    return null
  }

  if (node.parentNode) {
    return node.parentNode
  }

  const root = node.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

// A content script can reach closed shadow roots as well: through
// dom.openOrClosedShadowRoot() (Chrome), or the element's openOrClosedShadowRoot
// property (Firefox, which has no dom API). Reading a closed root's host as
// plain light DOM would read its unrendered children instead of what the page
// shows.
function lookUpClosedShadowRoot(element: Element): ShadowRoot | null {
  const openOrClosedShadowRoot = browser.dom?.openOrClosedShadowRoot
  if (typeof openOrClosedShadowRoot === "function" && element instanceof HTMLElement) {
    try {
      return openOrClosedShadowRoot(element) ?? null
    } catch {
      return null
    }
  }

  const firefoxElement = element as Element & { openOrClosedShadowRoot?: ShadowRoot | null }
  return firefoxElement.openOrClosedShadowRoot ?? null
}

// dom.openOrClosedShadowRoot() takes ten times as long as reading shadowRoot,
// and reading a selection asks about the same elements many times over. A slot
// in a closed root is hidden from assignedSlot, so finding the slot that shows
// a node means asking each of the root's slots what it shows. So one read
// keeps the answers it gets to both. No page script runs during it, so none can
// attach a shadow root or move a node meanwhile.
let knownClosedShadowRoots: Map<Element, ShadowRoot | null> | null = null
let knownClosedSlots: Map<ShadowRoot, Map<Node, HTMLSlotElement>> | null = null

function rememberingClosedShadowRoots<T>(read: () => T): T {
  if (knownClosedShadowRoots) {
    return read()
  }

  knownClosedShadowRoots = new Map()
  knownClosedSlots = new Map()
  try {
    return read()
  } finally {
    knownClosedShadowRoots = null
    knownClosedSlots = null
  }
}

function readClosedShadowRoot(element: Element) {
  let shadowRoot = knownClosedShadowRoots?.get(element)
  if (shadowRoot === undefined) {
    shadowRoot = lookUpClosedShadowRoot(element)
    knownClosedShadowRoots?.set(element, shadowRoot)
  }
  return shadowRoot
}

// The slot that shows each node assigned to a slot in a closed shadow root.
function readClosedSlots(shadowRoot: ShadowRoot) {
  let slots = knownClosedSlots?.get(shadowRoot)
  if (!slots) {
    slots = new Map()
    for (const slot of shadowRoot.querySelectorAll("slot")) {
      for (const node of slot.assignedNodes()) {
        slots.set(node, slot)
      }
    }
    knownClosedSlots?.set(shadowRoot, slots)
  }
  return slots
}

function getShadowRootOf(node: Node | null | undefined) {
  if (!(node instanceof Element)) {
    return null
  }

  return node.shadowRoot ?? readClosedShadowRoot(node)
}

// https://github.com/mengxi-ream/read-frog/issues/2385
// Chrome hands the legacy selection API (anchorNode, getRangeAt, toString) a
// selection inside shadow roots as if it sat in the document: anchorNode becomes
// the outermost host's parent, and toString() only reads the tree the selection
// starts in. getComposedRanges() reports the real boundaries, but only inside the
// shadow roots it is handed, and puts any other boundary just before (start) or
// after (end) the host it couldn't enter. So keep handing it the shadow root of
// the host each boundary stopped at, until neither boundary moves.
// Null where there is no getComposedRanges() or it reports no range.
function readComposedRangeSnapshots(selection: Selection): SelectionRangeSnapshot[] | null {
  const composedSelection = selection as Selection & {
    getComposedRanges?: (options?: { shadowRoots?: ShadowRoot[] }) => SelectionRangeSource[]
  }
  if (typeof composedSelection.getComposedRanges !== "function") {
    return null
  }

  const shadowRoots = new Set<ShadowRoot>()
  for (;;) {
    const ranges = composedSelection.getComposedRanges({ shadowRoots: [...shadowRoots] })
    if (ranges.length === 0) {
      return null
    }

    const knownRootCount = shadowRoots.size
    for (const range of ranges) {
      for (const host of [
        range.startContainer.childNodes[range.startOffset],
        range.endContainer.childNodes[range.endOffset - 1],
      ]) {
        const shadowRoot = getShadowRootOf(host)
        if (shadowRoot) {
          shadowRoots.add(shadowRoot)
        }
      }
    }

    if (shadowRoots.size === knownRootCount) {
      return ranges.map(createRangeSnapshot)
    }
  }
}

// Browsers without getComposedRanges() (Chrome before 137, Firefox before 142).
// Their ranges stop at the outermost shadow host.
function readLegacyRangeSnapshots(selection: Selection) {
  const snapshots: SelectionRangeSnapshot[] = []
  const rangeCount = typeof selection.rangeCount === "number" ? selection.rangeCount : 0

  for (let index = 0; index < Math.max(rangeCount, 1); index += 1) {
    try {
      snapshots.push(createRangeSnapshot(selection.getRangeAt(index)))
    } catch {
      break
    }
  }

  return snapshots
}

function getDeepActiveElement() {
  let activeElement = document.activeElement
  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement
  }

  return activeElement
}

function readTextControlSelection(): TextControlSelectionSnapshot | null {
  const control = getDeepActiveElement()
  const isTextControl =
    control instanceof HTMLTextAreaElement ||
    (control instanceof HTMLInputElement && TEXT_CONTROL_INPUT_TYPES.has(control.type))
  if (!isTextControl) {
    return null
  }

  const { selectionStart, selectionEnd, value } = control
  // A focused control with a collapsed caret is not where the selected text came from.
  if (selectionStart !== null && selectionStart === selectionEnd) {
    return null
  }

  return { value, selectionStart, selectionEnd }
}

// Whether a range in one tree holds furigana, or sits inside it.
function holdsRubyAnnotation(range: SelectionRangeSnapshot) {
  const root = getTraversalRoot(range)
  if (root instanceof Element && root.closest(RUBY_ANNOTATION_SELECTOR)) {
    return true
  }
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) {
    return false
  }

  let liveRange: Range
  try {
    liveRange = toLiveRange(range)
  } catch {
    // Firefox counts a boundary in slotted content among the slot's assigned
    // nodes, which can be past the end of the slot's own children.
    return false
  }
  return [...root.querySelectorAll(RUBY_ANNOTATION_SELECTOR)].some((annotation) =>
    liveRange.intersectsNode(annotation),
  )
}

function isCollapsed({
  startContainer,
  startOffset,
  endContainer,
  endOffset,
}: SelectionRangeSnapshot) {
  return startContainer === endContainer && startOffset === endOffset
}

// Selection.toString() is the browser's own reading of the page, and right for
// most selections. It reads these wrong: one whose ends are in different trees,
// of which it reads only the tree it starts in (#2385), one holding furigana,
// which it reads along with the base text, and one whose text is all in shadow
// roots inside it (or any in a shadow root, in Firefox), which it reads as
// nothing. A caret selects nothing, so it is never read.
function needsOwnReading(range: SelectionRangeSnapshot, browserText: string) {
  return (
    !isCollapsed(range) && (browserText === "" || !isInOneTree(range) || holdsRubyAnnotation(range))
  )
}

export function readSelectionSnapshot(selection: Selection | null): SelectionSnapshot | null {
  return rememberingClosedShadowRoots(() => readSelection(selection))
}

function readSelection(selection: Selection | null): SelectionSnapshot | null {
  if (!selection) {
    return null
  }

  const composedRanges = readComposedRangeSnapshots(selection)
  const ranges = composedRanges ?? readLegacyRangeSnapshots(selection)
  const textControl = readTextControlSelection()
  // A text control's text is in its value, out of the ranges' reach. Where our
  // own reading finds nothing, the browser's text is kept, so a selection whose
  // string has text always has a snapshot.
  const browserText = normalizeSelectedText(selection.toString())
  const text =
    !textControl && ranges.some((range) => needsOwnReading(range, browserText))
      ? readRangesText(ranges) || browserText
      : browserText

  if (text === "" || ranges.length === 0) {
    return null
  }

  return textControl ? { text, ranges, textControl } : { text, ranges }
}

// The flat tree is what the page renders: a shadow host shows its shadow root's
// children, and a <slot> shows the nodes assigned to it. Range, TreeWalker and
// Selection.toString() each stay inside one tree, so selected text that spans
// shadow roots is read along the flat tree instead.
function getFlatChildren(node: Node): Node[] {
  const shadowRoot = getShadowRootOf(node)
  if (shadowRoot) {
    return [...shadowRoot.childNodes]
  }

  if (node instanceof HTMLSlotElement) {
    const assignedNodes = node.assignedNodes()
    if (assignedNodes.length > 0) {
      return assignedNodes
    }
  }

  return [...node.childNodes]
}

function getFlatParent(node: Node): Node | null {
  if (node instanceof ShadowRoot) {
    return node.host
  }

  return getAssignedSlot(node) ?? getParentNodeAcrossShadow(node)
}

// assignedSlot is null for a slot in a closed shadow root, so look the slot up
// in the host's closed root.
function getAssignedSlot(node: Node) {
  if (!(node instanceof Element || node instanceof Text)) {
    return null
  }
  if (node.assignedSlot) {
    return node.assignedSlot
  }

  const host = node.parentNode
  const closedShadowRoot =
    host instanceof Element && !host.shadowRoot ? getShadowRootOf(host) : null
  return closedShadowRoot ? (readClosedSlots(closedShadowRoot).get(node) ?? null) : null
}

function getFlatParentElement(node: Node) {
  let parent = getFlatParent(node)
  while (parent && !(parent instanceof Element)) {
    parent = getFlatParent(parent)
  }
  return parent
}

interface TextPiece {
  node: Text | HTMLBRElement
  start: number
  end: number
}

// Where a boundary point falls in a walk: inside a text node, in front of a
// node, or after the last child of a node.
interface Boundary {
  text: Text | null
  offset: number
  before: Node | null
  endOf: Node | null
}

function isSlotShowingAssignedNodes(node: Node): node is HTMLSlotElement {
  return node instanceof HTMLSlotElement && node.assignedNodes().length > 0
}

// Whether the flat tree shows `node` where getFlatParent() puts it. It doesn't
// show a host's light child that no slot takes (a framework's comment marker,
// whitespace between named slots), a slot's fallback while the slot shows
// assigned nodes, or a closed shadow root this script can't reach.
function isShownByFlatParent(node: Node) {
  if (node instanceof ShadowRoot) {
    return getShadowRootOf(node.host) === node
  }
  if (getAssignedSlot(node)) {
    return true
  }

  const parent = node.parentNode
  return !parent || !(getShadowRootOf(parent) || isSlotShowingAssignedNodes(parent))
}

// The outermost node from `node` up that the flat tree doesn't show, or null.
function findUnshownAncestor(node: Node) {
  let unshown: Node | null = null
  for (let current: Node | null = node; current; current = getFlatParent(current)) {
    if (!isShownByFlatParent(current)) {
      unshown = current
    }
  }
  return unshown
}

function locateBoundary(container: Node, offset: number): Boundary {
  const unshown = findUnshownAncestor(container)
  if (unshown) {
    return locateUnshownBoundary(unshown)
  }
  if (container instanceof Text) {
    return { text: container, offset, before: null, endOf: null }
  }
  // A host renders its shadow root in place of its light children. Chrome's
  // legacy API, all there is without getComposedRanges(), reports a boundary
  // at the start of what a host renders as offset 0 in the host, whatever
  // light child a slot shows first.
  if (getShadowRootOf(container)) {
    return offset === 0 ? locateStartOf(container) : locateAmongChildren(container, offset)
  }

  // Firefox counts a boundary in slotted content among the slot's assigned
  // nodes, where the DOM counts the slot's own children, its fallback.
  const child = isSlotShowingAssignedNodes(container)
    ? container.assignedNodes()[offset]
    : container.childNodes[offset]
  return child
    ? { text: null, offset: 0, before: child, endOf: null }
    : { text: null, offset: 0, before: null, endOf: container }
}

function locateUnshownBoundary(unshown: Node): Boundary {
  const parent = getFlatParent(unshown)
  if (!parent) {
    return { text: null, offset: 0, before: null, endOf: unshown }
  }

  const siblings: Node[] = [...parent.childNodes]
  // A shadow root comes before the host's light children.
  return locateAmongChildren(parent, unshown instanceof ShadowRoot ? 0 : siblings.indexOf(unshown))
}

// A boundary among the children of a node that renders other nodes in their
// place: a shadow host, or a slot showing its assigned nodes. The walk never
// meets a boundary at a child the page doesn't render, and would read on to
// the end of the page looking for it. So it moves to the next child from
// `index` on that the page renders, such as a host's light child that a slot
// shows. Failing that, to just after the last one before `index`, or to the
// start of what the node renders.
function locateAmongChildren(parent: Node, index: number): Boundary {
  const children = [...parent.childNodes]
  const isShown = (node: Node) => findUnshownAncestor(node) === null
  const next = children.slice(index).find(isShown)
  if (next) {
    return { text: null, offset: 0, before: next, endOf: null }
  }

  const previous = children.slice(0, index).findLast(isShown)
  return previous ? locateAfter(previous) : locateStartOf(parent)
}

// The start of what `node` renders.
function locateStartOf(node: Node): Boundary {
  const first = getFlatChildren(node)[0]
  return first
    ? { text: null, offset: 0, before: first, endOf: null }
    : { text: null, offset: 0, before: null, endOf: node }
}

// Just after `node` where the page renders it: a slotted node in its slot,
// not after all its host renders.
function locateAfter(node: Node): Boundary {
  const parent = getFlatParent(node)
  if (!parent) {
    return { text: null, offset: 0, before: null, endOf: node }
  }

  const siblings = getFlatChildren(parent)
  const next = siblings[siblings.indexOf(node) + 1]
  return next
    ? { text: null, offset: 0, before: next, endOf: null }
    : { text: null, offset: 0, before: null, endOf: parent }
}

interface TextVisibility {
  // Not rendered: holds for the whole subtree.
  hidden: boolean
  // user-select: none, until a descendant opts back in.
  unselectable: boolean
  // visibility: hidden, which a descendant can undo with visibility: visible.
  invisible: boolean
}

function isLeftOut({ hidden, unselectable, invisible }: TextVisibility) {
  return hidden || unselectable || invisible
}

// A closed <details> shows its summary and nothing else. Undefined for any
// other node, which shows all its children.
function findClosedDetailsSummary(node: Node) {
  return node instanceof HTMLDetailsElement && !node.open
    ? node.querySelector(":scope > summary")
    : undefined
}

// An <object> showing its resource, such as an image, doesn't render its
// children, which are its fallback. Only layout tells which one it shows: the
// children take up room on the page only as the fallback. Without layout, the
// fallback is taken as shown.
function isShowingObjectResource(element: Element) {
  if (!(element instanceof HTMLObjectElement)) {
    return false
  }

  const range = element.ownerDocument.createRange()
  range.selectNodeContents(element)
  return typeof range.getClientRects === "function" && range.getClientRects().length === 0
}

// What the browser leaves out of its selection text, left out here too.
function readChildTextVisibility(
  element: Element,
  range: SelectionRangeSnapshot,
  { hidden, unselectable, invisible }: TextVisibility,
): TextVisibility {
  if (
    hidden ||
    NON_CONTENT_ELEMENT_NAMES.has(element.localName) ||
    isShowingObjectResource(element)
  ) {
    return { hidden: true, unselectable, invisible }
  }

  // Furigana the reader selected on its own is what they mean to read.
  if (
    RUBY_ANNOTATION_ELEMENT_NAMES.has(element.localName) &&
    !(element.contains(range.startContainer) && element.contains(range.endContainer))
  ) {
    return { hidden: true, unselectable, invisible }
  }

  const style = window.getComputedStyle(element)
  return {
    // content-visibility: hidden (also how hidden="until-found" hides) keeps the
    // element's box but skips everything in it.
    hidden: style.display === "none" || style.contentVisibility === "hidden",
    unselectable:
      style.userSelect === "none" ||
      (unselectable && style.userSelect !== "text" && style.userSelect !== "all"),
    invisible: style.visibility !== "visible",
  }
}

// The text a range covers, in reading order, through every open shadow root and
// slot on the way. getComposedRanges() puts a range's ends in tree order, where
// a host's shadow root comes before its slotted children, but the page can show
// a slotted child first. So the walk starts at whichever end it reaches first.
function collectRangeTextPieces(range: SelectionRangeSnapshot): TextPiece[] {
  // A removed end is never met, and the walk would read on to the end of the page.
  if (!range.startContainer.isConnected || !range.endContainer.isConnected) {
    return []
  }

  return walkTextPieces(
    range,
    getTraversalRoot(range),
    [
      locateBoundary(range.startContainer, range.startOffset),
      locateBoundary(range.endContainer, range.endOffset),
    ],
    { hidden: false, unselectable: false, invisible: false },
    false,
  )
}

// Walks `root` along the flat tree, collecting the text between `ends`. A walk
// that starts inside the range collects from the start of `root` on.
function walkTextPieces(
  range: SelectionRangeSnapshot,
  root: Node,
  ends: Boundary[],
  rootVisibility: TextVisibility,
  startsInside: boolean,
): TextPiece[] {
  // The flat-tree branches that hold the ends. A slotted node is reached through
  // its slot, not its light parent.
  const endPaths = new Set<Node>()
  for (const end of ends) {
    for (
      let node: Node | null = end.text ?? end.before ?? end.endOf;
      node;
      node = getFlatParent(node)
    ) {
      endPaths.add(node)
    }
  }

  const pieces: TextPiece[] = []
  let inside = startsInside
  let done = false
  // Reaching an end opens the range, or closes it once it is open.
  const reachEnd = () => {
    done = inside
    inside = true
  }

  const visit = (node: Node, visibility: TextVisibility) => {
    for (const end of ends) {
      if (node === end.before) {
        reachEnd()
        if (done) {
          return
        }
      }
    }
    // Until an end, only the branches that hold one need walking.
    if (!inside && !endPaths.has(node)) {
      return
    }
    // Read Frog's own UI (toolbar, diagnosis panel, annotation layer) hangs off
    // <body> in shadow roots. It is no part of the page, unless the selection
    // is in it.
    if (
      !endPaths.has(node) &&
      node instanceof Element &&
      node.matches(READ_FROG_UI_HOST_SELECTOR)
    ) {
      return
    }

    if (node instanceof Text) {
      let from = 0
      let to = node.data.length
      // Both ends in one text node are in one tree, so in order.
      for (const end of ends) {
        if (end.text === node) {
          if (inside) {
            to = end.offset
          } else {
            from = end.offset
          }
          reachEnd()
        }
      }
      if (!isLeftOut(visibility) && to > from) {
        pieces.push({ node, start: from, end: to })
      }
      return
    }

    const childVisibility =
      node instanceof Element ? readChildTextVisibility(node, range, visibility) : visibility
    if (inside && node instanceof HTMLBRElement && !isLeftOut(childVisibility)) {
      pieces.push({ node, start: 0, end: 0 })
    }

    const summary = findClosedDetailsSummary(node)
    for (const child of getFlatChildren(node)) {
      const hidden = summary !== undefined && child !== summary
      visit(child, hidden ? { ...childVisibility, hidden } : childVisibility)
      if (done) {
        return
      }
    }

    const shadowRoot = getShadowRootOf(node)
    for (const end of ends) {
      if (node === end.endOf || (shadowRoot !== null && shadowRoot === end.endOf)) {
        reachEnd()
        if (done) {
          return
        }
      }
    }
  }

  visit(root, rootVisibility)
  return pieces
}

function readPieceText(piece: TextPiece) {
  return piece.node instanceof Text ? piece.node.data.slice(piece.start, piece.end) : "\n"
}

// Whitespace as the page renders it: kept where white-space keeps it, collapsed
// to one space elsewhere (pre-line keeps its line breaks).
function readRenderedPieceText(piece: TextPiece) {
  const value = readPieceText(piece)
  const parent = getFlatParentElement(piece.node)
  const whiteSpace = parent ? window.getComputedStyle(parent).whiteSpace : "normal"
  if (SPACE_PRESERVING_WHITE_SPACE.has(whiteSpace)) {
    return { value, collapsible: false }
  }

  const collapsed = value.replace(
    whiteSpace === "pre-line" ? NON_NEWLINE_WHITESPACE_REGEX : WHITESPACE_REGEX,
    " ",
  )
  return { value: collapsed, collapsible: true }
}

// The box a piece of text is laid out in: the innermost paragraph or block-level
// box around it. Text in another one starts a new line. Unlike a paragraph
// owner, a <section> or <article> counts here: it is too broad to be one
// paragraph of context, but the page still breaks lines at it.
function findLineBox(node: Node): Element | null {
  for (
    let current = getFlatParentElement(node);
    current && current !== current.ownerDocument.documentElement;
    current = getFlatParentElement(current)
  ) {
    if (
      PARAGRAPH_LIKE_TAGS.has(current.tagName) ||
      PARAGRAPH_DISPLAY_VALUES.has(window.getComputedStyle(current).display)
    ) {
      return current
    }
  }
  return null
}

// Leaving a <p>, other than for a block inside it, leaves a blank line in
// Chrome's selection text, as it does in innerText.
function leavesParagraph(previousBox: Element | null, box: Element | null) {
  if (previousBox?.localName !== "p") {
    return false
  }

  for (let node: Node | null = box; node; node = getFlatParent(node)) {
    if (node === previousBox) {
      return false
    }
  }
  return true
}

// Close to what Selection.toString() gives: whitespace as rendered, and a <br>
// or text in another block starts a new line.
function readRangesText(ranges: SelectionRangeSnapshot[]) {
  let text = ""
  const startNewLine = (blankLine: boolean) => {
    text = text.replace(TRAILING_SPACES_REGEX, "")
    if (text === "") {
      return
    }
    if (!text.endsWith("\n")) {
      text += "\n"
    }
    if (blankLine && !text.endsWith("\n\n")) {
      text += "\n"
    }
  }

  for (const range of ranges) {
    let previousBox: Element | null | undefined
    for (const piece of collectRangeTextPieces(range)) {
      if (!(piece.node instanceof Text)) {
        text = `${text.replace(TRAILING_SPACES_REGEX, "")}\n`
        continue
      }

      const { value, collapsible } = readRenderedPieceText(piece)
      // Whitespace between two boxes doesn't open a line of its own.
      if (value.trim() !== "") {
        const box = findLineBox(piece.node)
        if (previousBox !== undefined && box !== previousBox) {
          startNewLine(leavesParagraph(previousBox, box))
        }
        previousBox = box
      }

      const joinsCollapsedSpace =
        collapsible && (text === "" || ENDS_WITH_COLLAPSED_SPACE_REGEX.test(text))
      text += joinsCollapsedSpace ? value.replace(LEADING_SPACES_REGEX, "") : value
    }
    startNewLine(false)
  }

  return normalizeSelectedText(text)
}

// Client rects of what a range covers. A live Range measures a range inside one
// tree; one that spans shadow roots is measured by the text it covers.
export function readRangeClientRects(range: SelectionRangeSnapshot): DOMRect[] {
  return rememberingClosedShadowRoots(() => measureRange(range))
}

function measureRange(range: SelectionRangeSnapshot): DOMRect[] {
  if (isInOneTree(range)) {
    try {
      return [...toLiveRange(range).getClientRects()]
    } catch {
      // Firefox's count among a slot's assigned nodes can be past the end of
      // the slot's own children. The text pieces don't need the count to fit.
    }
  }

  // One Range measures every piece: the page updates each live Range on every
  // change to the DOM until it is collected, and this runs on every scroll frame.
  const pieceRange = document.createRange()
  return collectRangeTextPieces(range).flatMap((piece) => {
    if (piece.node instanceof Text) {
      pieceRange.setStart(piece.node, piece.start)
      pieceRange.setEnd(piece.node, piece.end)
    } else {
      pieceRange.selectNode(piece.node)
    }
    return [...pieceRange.getClientRects()]
  })
}

function getCommonAncestorNode(startContainer: Node, endContainer: Node) {
  const startAncestors = new Set<Node>()
  let current: Node | null = startContainer

  while (current) {
    startAncestors.add(current)
    current = getParentNodeAcrossShadow(current)
  }

  current = endContainer
  while (current) {
    if (startAncestors.has(current)) {
      return current
    }

    current = getParentNodeAcrossShadow(current)
  }

  return startContainer.ownerDocument?.body ?? startContainer
}

function getTraversalRoot(rangeSnapshot: SelectionRangeSnapshot) {
  const commonAncestor = getCommonAncestorNode(
    rangeSnapshot.startContainer,
    rangeSnapshot.endContainer,
  )

  if (commonAncestor instanceof Text) {
    return commonAncestor.parentNode ?? commonAncestor
  }

  return commonAncestor
}

function isParagraphLikeDisplay(element: Element) {
  if (SEMANTIC_CONTAINER_TAGS.has(element.tagName)) {
    return false
  }

  return PARAGRAPH_DISPLAY_VALUES.has(window.getComputedStyle(element).display)
}

// Up the flat tree, the way the page lays text out: text in a shadow root sits
// in the paragraph around its host, and slotted text in the one around its slot.
function findParagraphOwner(node: Node | null): ParagraphOwner | null {
  let current = node instanceof Element ? node : node ? getFlatParentElement(node) : null
  let semanticFallback: ParagraphOwner | null = null

  // <html> is display:block too, but owning it would pull in <head> text.
  while (current && current !== current.ownerDocument.documentElement) {
    if (PARAGRAPH_LIKE_TAGS.has(current.tagName)) {
      return current
    }

    if (SEMANTIC_CONTAINER_TAGS.has(current.tagName)) {
      semanticFallback ??= current
    } else if (isParagraphLikeDisplay(current)) {
      return current
    }

    current = getFlatParentElement(current)
  }

  return semanticFallback
}

// What the walk from the owner's parent down to the owner leaves out, so the
// owner can be walked on its own.
function readOwnerVisibility(owner: ParagraphOwner, range: SelectionRangeSnapshot) {
  const parent = owner.parentNode
  const path: Node[] = []
  for (let node = getFlatParent(owner); node; node = getFlatParent(node)) {
    path.unshift(node)
    if (node === parent) {
      break
    }
  }

  let visibility: TextVisibility = { hidden: false, unselectable: false, invisible: false }
  path.forEach((node, index) => {
    if (node instanceof Element) {
      visibility = readChildTextVisibility(node, range, visibility)
    }
    const child = path[index + 1] ?? owner
    const summary = findClosedDetailsSummary(node)
    if (summary !== undefined && child !== summary) {
      visibility = { ...visibility, hidden: true }
    }
  })
  return visibility
}

function extractOwnerText(owner: ParagraphOwner) {
  const parent = owner.parentNode
  if (!parent) {
    return ""
  }

  // All the owner renders, its shadow root included. The walk starts at the
  // owner rather than its parent, so long runs of sibling paragraphs aren't
  // rescanned once per paragraph, and reads all of it, so it needs no end. The
  // owner's next sibling would be no end: slots can render that sibling before
  // the owner, or not at all. Furigana is left out as it is from a range around
  // the owner.
  const range = {
    startContainer: parent,
    startOffset: 0,
    endContainer: owner,
    endOffset: owner.childNodes.length,
  }
  const pieces = walkTextPieces(range, owner, [], readOwnerVisibility(owner, range), true)
  return normalizeParagraphText(
    pieces.map((piece) => (piece.node instanceof Text ? readPieceText(piece) : " ")).join(""),
  )
}

// Paragraphs in the order the page shows them. The pieces give that order for
// paragraphs side by side, but they reach a paragraph that holds another (a post
// around a quote) at its first own text, which can come after what it holds.
// It goes first, as it comes first on the page, so a long quote can't push the
// rest of the post past the context's length limit.
function placeHoldersFirst(owners: ParagraphOwner[]) {
  const ownerSet = new Set(owners)
  const holders = new Map<ParagraphOwner, ParagraphOwner | null>()
  const findHolder = (owner: ParagraphOwner) => {
    let holder = holders.get(owner)
    if (holder === undefined) {
      holder = getFlatParentElement(owner)
      while (holder && !ownerSet.has(holder)) {
        holder = getFlatParentElement(holder)
      }
      holders.set(owner, holder)
    }
    return holder
  }

  // Each holder's paragraphs, in the order the first text in each comes.
  const held = new Map<ParagraphOwner | null, ParagraphOwner[]>()
  const placed = new Set<ParagraphOwner>()
  const place = (owner: ParagraphOwner) => {
    if (placed.has(owner)) {
      return
    }
    placed.add(owner)
    const holder = findHolder(owner)
    if (holder) {
      place(holder)
    }
    const siblings = held.get(holder)
    if (siblings) {
      siblings.push(owner)
    } else {
      held.set(holder, [owner])
    }
  }
  owners.forEach(place)

  const ordered: ParagraphOwner[] = []
  const append = (holder: ParagraphOwner | null) => {
    for (const owner of held.get(holder) ?? []) {
      ordered.push(owner)
      append(owner)
    }
  }
  append(null)
  return ordered
}

function collectParagraphOwners(rangeSnapshots: SelectionRangeSnapshot[]) {
  const paragraphOwners = new Set<ParagraphOwner>()

  for (const rangeSnapshot of rangeSnapshots) {
    let hasTextPiece = false
    for (const piece of collectRangeTextPieces(rangeSnapshot)) {
      if (!(piece.node instanceof Text) || normalizeParagraphText(piece.node.data) === "") {
        continue
      }

      const owner = findParagraphOwner(piece.node)
      if (owner) {
        paragraphOwners.add(owner)
        hasTextPiece = true
      }
    }

    if (!hasTextPiece) {
      const owner = findParagraphOwner(rangeSnapshot.startContainer)
      if (owner) {
        paragraphOwners.add(owner)
      }
    }
  }

  return placeHoldersFirst([...paragraphOwners])
}

// Blank-line separated blocks of the control's value that overlap the selection.
function collectTextControlParagraphs({
  value,
  selectionStart,
  selectionEnd,
}: TextControlSelectionSnapshot) {
  const start = selectionStart ?? 0
  const end = selectionEnd ?? value.length
  const paragraphs: string[] = []
  let blockStart = 0

  for (const block of value.split(TEXT_CONTROL_PARAGRAPH_BREAK_REGEX)) {
    const blockEnd = blockStart + block.length
    const paragraph = normalizeParagraphText(block)
    if (paragraph !== "" && blockStart < end && blockEnd > start) {
      paragraphs.push(paragraph)
    }
    blockStart = blockEnd
  }

  return paragraphs
}

export function buildContextSnapshot(selection: SelectionSnapshot | null): ContextSnapshot | null {
  return rememberingClosedShadowRoots(() => buildContext(selection))
}

function buildContext(selection: SelectionSnapshot | null): ContextSnapshot | null {
  if (!selection || selection.text === "") {
    return null
  }

  const paragraphs = selection.textControl
    ? collectTextControlParagraphs(selection.textControl)
    : collectParagraphOwners(selection.ranges).map(extractOwnerText).filter(Boolean)

  if (paragraphs.length === 0) {
    return {
      text: selection.text,
      paragraphs: [selection.text],
    }
  }

  return {
    text: paragraphs.join(PARAGRAPH_SEPARATOR),
    paragraphs,
  }
}
