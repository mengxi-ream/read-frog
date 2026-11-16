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
// default value, and a frame, canvas, select box, meter or media element shows
// something else in place of what it holds. So it must not leak into the
// selected text or paragraph context.
const NON_CONTENT_ELEMENT_NAMES = new Set([
  "audio",
  "canvas",
  "head",
  "iframe",
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

function getShadowRootOf(node: Node | null | undefined) {
  return node instanceof Element ? node.shadowRoot : null
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

  const liveRange = toLiveRange(range)
  return [...root.querySelectorAll(RUBY_ANNOTATION_SELECTOR)].some((annotation) =>
    liveRange.intersectsNode(annotation),
  )
}

// Selection.toString() is the browser's own reading of the page, and right for
// most selections. Two it reads wrong: one whose ends are in different trees,
// of which it reads only the tree it starts in (#2385), and one holding
// furigana, which it reads along with the base text.
function needsOwnReading(range: SelectionRangeSnapshot) {
  return !isInOneTree(range) || holdsRubyAnnotation(range)
}

export function readSelectionSnapshot(selection: Selection | null): SelectionSnapshot | null {
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
    !textControl && ranges.some(needsOwnReading)
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

  const assignedSlot = node instanceof Element || node instanceof Text ? node.assignedSlot : null
  return assignedSlot ?? getParentNodeAcrossShadow(node)
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
function locateBoundary(container: Node, offset: number) {
  if (container instanceof Text) {
    return { text: container, offset, before: null, endOf: null }
  }

  const child = container.childNodes[offset]
  return child
    ? { text: null, offset: 0, before: child, endOf: null }
    : { text: null, offset: 0, before: null, endOf: container }
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

// What the browser leaves out of its selection text, left out here too.
function readChildTextVisibility(
  element: Element,
  range: SelectionRangeSnapshot,
  { hidden, unselectable, invisible }: TextVisibility,
): TextVisibility {
  if (hidden || NON_CONTENT_ELEMENT_NAMES.has(element.localName)) {
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
  const ends = [
    locateBoundary(range.startContainer, range.startOffset),
    locateBoundary(range.endContainer, range.endOffset),
  ]
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
  let inside = false
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

    // A closed <details> shows its summary and nothing else.
    const summary =
      node instanceof HTMLDetailsElement && !node.open
        ? node.querySelector(":scope > summary")
        : undefined
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

  visit(getTraversalRoot(range), { hidden: false, unselectable: false, invisible: false })
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

// Leaving a <p>, other than for a block inside it, leaves a blank line in
// Chrome's selection text, as it does in innerText.
function leavesParagraph(previousOwner: ParagraphOwner | null, owner: ParagraphOwner | null) {
  if (previousOwner?.localName !== "p") {
    return false
  }

  for (let node: Node | null = owner; node; node = getFlatParent(node)) {
    if (node === previousOwner) {
      return false
    }
  }
  return true
}

// Close to what Selection.toString() gives: whitespace as rendered, and a <br>
// or text in another paragraph starts a new line.
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
    let previousOwner: ParagraphOwner | null | undefined
    for (const piece of collectRangeTextPieces(range)) {
      if (!(piece.node instanceof Text)) {
        text = `${text.replace(TRAILING_SPACES_REGEX, "")}\n`
        continue
      }

      const { value, collapsible } = readRenderedPieceText(piece)
      // Whitespace between two boxes doesn't open a paragraph of its own.
      if (value.trim() !== "") {
        const owner = findParagraphOwner(piece.node)
        if (previousOwner !== undefined && owner !== previousOwner) {
          startNewLine(leavesParagraph(previousOwner, owner))
        }
        previousOwner = owner
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
  if (isInOneTree(range)) {
    return [...toLiveRange(range).getClientRects()]
  }

  return collectRangeTextPieces(range).flatMap((piece) => {
    const pieceRange = document.createRange()
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

function extractOwnerText(owner: ParagraphOwner) {
  const parent = owner.parentNode
  if (!parent) {
    return ""
  }

  // From just before the owner to its end, which the walk takes as the end of all
  // it renders, its shadow root included. The owner's next sibling is no end:
  // slots can render that sibling before the owner, or not at all.
  const index = Array.prototype.indexOf.call(parent.childNodes, owner)
  const pieces = collectRangeTextPieces({
    startContainer: parent,
    startOffset: index,
    endContainer: owner,
    endOffset: owner.childNodes.length,
  })
  return normalizeParagraphText(
    pieces.map((piece) => (piece.node instanceof Text ? readPieceText(piece) : " ")).join(""),
  )
}

// Owners come out in reading order, since the pieces do.
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

  return [...paragraphOwners]
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
