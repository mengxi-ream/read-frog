/**
 * Extract context sentences from text based on selection
 * This function handles pure text processing without DOM dependencies
 */
export function extractTextContext(fullText: string, selection: string) {
  // Handle edge cases
  if (selection === "" || fullText === "" || !fullText.includes(selection)) {
    return { before: "", selection, after: "" }
  }

  const index = fullText.indexOf(selection)

  // If selection is the entire text, return it with no context
  if (index === 0 && selection.length === fullText.length) {
    return { before: "", selection, after: "" }
  }

  // Find sentence boundaries around the selection
  const sentenceEndings = /[.!?。！？]/

  // Find the start of the current sentence (before the selection)
  let sentenceStart = 0
  for (let i = index - 1; i >= 0; i--) {
    if (sentenceEndings.test(fullText[i])) {
      sentenceStart = i + 1
      break
    }
  }

  // Find the end of the current sentence (after the selection)
  let sentenceEnd = fullText.length
  for (let i = index + selection.length; i < fullText.length; i++) {
    if (sentenceEndings.test(fullText[i])) {
      sentenceEnd = i + 1
      break
    }
  }

  // Extract the sentence containing the selection
  const sentence = fullText.slice(sentenceStart, sentenceEnd)
  const relativeIndex = sentence.indexOf(selection)

  // If selection is at the beginning or end of sentence, return empty context
  if (relativeIndex === 0 || relativeIndex + selection.length === sentence.length) {
    return { before: "", selection, after: "" }
  }

  const before = sentence.slice(0, relativeIndex)
  const after = sentence.slice(relativeIndex + selection.length)

  return { before, selection, after }
}

/**
 * Get the context sentences for the selected text
 * TODO: this is a simple version, need to improve
 */
export function getContext(selectionRange: Range) {
  const container = selectionRange.commonAncestorContainer
  let root: Node | null = null

  if (container.nodeType === Node.TEXT_NODE) {
    root = container.parentElement
  }
  else {
    root = container
  }

  const fullText = root?.textContent ?? ""
  const selection = selectionRange.toString()

  return extractTextContext(fullText, selection)
}

interface Context {
  before: string
  selection: string
  after: string
}

export interface HighlightData {
  context: Context
}

/**
 * Create highlight data
 */
export function createHighlightData(selectionRange: Range): HighlightData {
  return {
    context: getContext(selectionRange),
  }
}

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

function isParagraphLikeElement(element: HTMLElement) {
  if (element.tagName === "BODY") {
    return false
  }

  if (PARAGRAPH_LIKE_TAGS.has(element.tagName)) {
    return true
  }

  const display = window.getComputedStyle(element).display
  return [
    "block",
    "list-item",
    "table-cell",
    "table-row",
    "flex",
    "grid",
  ].includes(display)
}

function findNearestParagraphElement(node: Node | null) {
  if (!node) {
    return null
  }

  let current: HTMLElement | null = node instanceof HTMLElement
    ? node
    : node.parentElement

  while (current) {
    if (isParagraphLikeElement(current)) {
      return current
    }
    current = current.parentElement
  }

  return null
}

function normalizeTextContent(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

export function getSelectionParagraphText(selectionRange: Range) {
  const paragraph
    = findNearestParagraphElement(selectionRange.startContainer)
      ?? findNearestParagraphElement(selectionRange.commonAncestorContainer)

  if (paragraph?.textContent) {
    return normalizeTextContent(paragraph.textContent)
  }

  return normalizeTextContent(selectionRange.commonAncestorContainer.textContent ?? "")
}
