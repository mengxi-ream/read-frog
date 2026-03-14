export interface SelectionRangeSnapshot {
  startContainer: Node
  startOffset: number
  endContainer: Node
  endOffset: number
}

export interface SelectionSnapshot {
  text: string
  ranges: SelectionRangeSnapshot[]
}

export interface ContextSnapshot {
  text: string
  paragraphs: string[]
}

type SelectionRangeSource = SelectionRangeSnapshot

type ParagraphOwner = Element | ShadowRoot

const ZERO_WIDTH_CHAR_REGEX = /\u200B/g
const WHITESPACE_REGEX = /\s+/g
const PARAGRAPH_SEPARATOR = "\n\n"
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
const SEMANTIC_CONTAINER_TAGS = new Set([
  "ARTICLE",
  "ASIDE",
  "BODY",
  "MAIN",
  "NAV",
  "SECTION",
])
const PARAGRAPH_DISPLAY_VALUES = new Set([
  "block",
  "list-item",
])

export const CUSTOM_ACTION_CONTEXT_CHAR_LIMIT = 2000

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

export function toLiveRange(rangeSnapshot: SelectionRangeSnapshot) {
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

function getParentElementAcrossShadow(element: Element | null) {
  if (!element) {
    return null
  }

  if (element.parentElement) {
    return element.parentElement
  }

  const root = element.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

function getNearestParentElement(node: Node | null) {
  if (!node) {
    return null
  }

  if (node instanceof Element) {
    return node
  }

  const parentNode = getParentNodeAcrossShadow(node)
  return parentNode instanceof Element ? parentNode : null
}

function collectSelectionBoundaryNodes(selection: Selection) {
  const boundaryNodes = new Set<Node>()

  if (selection.anchorNode) {
    boundaryNodes.add(selection.anchorNode)
  }
  if (selection.focusNode) {
    boundaryNodes.add(selection.focusNode)
  }

  const rangeCount = typeof selection.rangeCount === "number" ? selection.rangeCount : 0

  for (let index = 0; index < rangeCount; index += 1) {
    try {
      const range = selection.getRangeAt(index)
      boundaryNodes.add(range.startContainer)
      boundaryNodes.add(range.endContainer)
    }
    catch {
      break
    }
  }

  return Array.from(boundaryNodes)
}

function collectSelectionShadowRoots(selection: Selection) {
  const shadowRoots = new Set<ShadowRoot>()

  for (const boundaryNode of collectSelectionBoundaryNodes(selection)) {
    let current: Node | null = boundaryNode

    while (current) {
      const root = current.getRootNode()
      if (!(root instanceof ShadowRoot)) {
        break
      }

      shadowRoots.add(root)
      current = root.host
    }
  }

  return Array.from(shadowRoots)
}

function readSelectionRangeSnapshots(selection: Selection | null) {
  if (!selection) {
    return []
  }

  const composedSelection = selection as Selection & {
    getComposedRanges?: (options?: { shadowRoots?: ShadowRoot[] }) => SelectionRangeSource[]
  }

  if (typeof composedSelection.getComposedRanges === "function") {
    const composedRanges = composedSelection.getComposedRanges({
      shadowRoots: collectSelectionShadowRoots(selection),
    })

    if (composedRanges.length > 0) {
      return composedRanges.map(createRangeSnapshot)
    }
  }

  const snapshots: SelectionRangeSnapshot[] = []
  const rangeCount = typeof selection.rangeCount === "number" ? selection.rangeCount : 0

  if (rangeCount > 0) {
    for (let index = 0; index < rangeCount; index += 1) {
      try {
        snapshots.push(createRangeSnapshot(selection.getRangeAt(index)))
      }
      catch {
        return snapshots
      }
    }

    return snapshots
  }

  try {
    snapshots.push(createRangeSnapshot(selection.getRangeAt(0)))
  }
  catch {
    return snapshots
  }

  return snapshots
}

export function readSelectionSnapshot(selection: Selection | null): SelectionSnapshot | null {
  const text = normalizeSelectedText(selection?.toString())
  if (text === "") {
    return null
  }

  const ranges = readSelectionRangeSnapshots(selection)
  if (ranges.length === 0) {
    return null
  }

  return {
    text,
    ranges,
  }
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

function doesRangeIntersectNode(range: Range, node: Node) {
  if (typeof range.intersectsNode === "function") {
    return range.intersectsNode(node)
  }

  const nodeRange = document.createRange()
  if (node instanceof Text) {
    nodeRange.selectNodeContents(node)
  }
  else {
    nodeRange.selectNode(node)
  }

  return !(
    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0
    || range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0
  )
}

function isParagraphLikeDisplay(element: Element) {
  if (SEMANTIC_CONTAINER_TAGS.has(element.tagName)) {
    return false
  }

  return PARAGRAPH_DISPLAY_VALUES.has(window.getComputedStyle(element).display)
}

function findParagraphOwner(node: Node | null): ParagraphOwner | null {
  let current = getNearestParentElement(node)
  let semanticFallback: ParagraphOwner | null = null

  while (current) {
    if (PARAGRAPH_LIKE_TAGS.has(current.tagName)) {
      return current
    }

    if (SEMANTIC_CONTAINER_TAGS.has(current.tagName)) {
      semanticFallback ??= current
    }
    else if (isParagraphLikeDisplay(current)) {
      return current
    }

    const parentElement = getParentElementAcrossShadow(current)
    if (!parentElement) {
      const root = current.getRootNode()
      if (root instanceof ShadowRoot) {
        return semanticFallback ?? root
      }
    }

    current = parentElement
  }

  return semanticFallback
}

function extractOwnerText(owner: ParagraphOwner) {
  const textParts: string[] = []
  const walker = document.createTreeWalker(owner, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return normalizeParagraphText(node.textContent ?? "") === ""
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    },
  })

  let currentNode = walker.nextNode()
  while (currentNode) {
    textParts.push(currentNode.textContent ?? "")
    currentNode = walker.nextNode()
  }

  return normalizeParagraphText(textParts.join(""))
}

function compareNodesInDocumentOrder(left: ParagraphOwner, right: ParagraphOwner) {
  if (left === right) {
    return 0
  }

  const position = left.compareDocumentPosition(right)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1
  }

  return 0
}

function collectParagraphOwners(rangeSnapshots: SelectionRangeSnapshot[]) {
  const paragraphOwners = new Set<ParagraphOwner>()

  for (const rangeSnapshot of rangeSnapshots) {
    let hasIntersectedTextNode = false
    let liveRange: Range

    try {
      liveRange = toLiveRange(rangeSnapshot)
    }
    catch {
      continue
    }

    const traversalRoot = getTraversalRoot(rangeSnapshot)
    const walker = document.createTreeWalker(traversalRoot, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return normalizeParagraphText(node.textContent ?? "") === ""
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
      },
    })

    let currentNode = walker.nextNode()
    while (currentNode) {
      if (currentNode instanceof Text && doesRangeIntersectNode(liveRange, currentNode)) {
        const owner = findParagraphOwner(currentNode)
        if (owner) {
          paragraphOwners.add(owner)
          hasIntersectedTextNode = true
        }
      }

      currentNode = walker.nextNode()
    }

    if (!hasIntersectedTextNode) {
      const owner = findParagraphOwner(rangeSnapshot.startContainer)
      if (owner) {
        paragraphOwners.add(owner)
      }
    }
  }

  return Array.from(paragraphOwners).sort(compareNodesInDocumentOrder)
}

export function buildContextSnapshot(selection: SelectionSnapshot | null): ContextSnapshot | null {
  if (!selection || selection.text === "") {
    return null
  }

  const paragraphs = collectParagraphOwners(selection.ranges)
    .map(extractOwnerText)
    .filter(Boolean)

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

export function truncateContextTextForCustomAction(
  contextText: string,
  limit = CUSTOM_ACTION_CONTEXT_CHAR_LIMIT,
) {
  return contextText.slice(0, limit)
}
