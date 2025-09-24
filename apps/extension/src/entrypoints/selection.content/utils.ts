/**
 * Extract context sentences from text based on selection
 * This function handles pure text processing without DOM dependencies
 */
export function extractTextContext(fullText: string, selection: string) {
  // Handle edge cases: empty text or empty selection
  if (selection === '' || fullText === '') {
    return { before: '', selection, after: '' }
  }

  const index = fullText.indexOf(selection)

  if (index === -1) {
    return { before: '', selection, after: '' }
  }

  // Handle case where selection equals full text
  if (index === 0 && selection.length === fullText.length) {
    return { before: '', selection, after: '' }
  }

  // Define sentence boundaries
  const boundaries = /[.!?。！？]/

  // Find previous boundary
  let start = 0
  for (let i = index - 1; i >= 0; i--) {
    if (boundaries.test(fullText[i])) {
      start = i + 1
      break
    }
  }

  // Find next boundary
  let end = fullText.length
  for (let i = index + selection.length; i < fullText.length; i++) {
    if (boundaries.test(fullText[i])) {
      end = i + 1
      break
    }
  }

  const sentence = fullText.slice(start, end).trim()
  const relIndex = sentence.indexOf(selection)

  const before = sentence.slice(0, relIndex)
  const after = sentence.slice(relIndex + selection.length)

  return { before, selection, after }
}

/**
 * Get the context sentences for the selected text
 * TODO: this is a simple version, need to improve
 */
export function getContext(selectionRange: Range) {
  const container = selectionRange.commonAncestorContainer
  const root = container.nodeType === Node.TEXT_NODE
    ? container.parentElement
    : (container as Element | null)

  const fullText = root?.textContent ?? ''
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
