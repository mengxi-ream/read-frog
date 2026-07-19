/** First alphabetic token of a selection, normalized for known-word lookups. */
export function getLeadingWord(selectionText: string | null | undefined): string | null {
  const word = selectionText
    ?.trim()
    .split(/\s+/)[0]
    ?.replace(/[^a-z'-]/gi, "")
    .toLowerCase()
  return word || null
}
