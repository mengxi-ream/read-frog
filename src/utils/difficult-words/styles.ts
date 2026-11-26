import type { MarkTone } from "./highlights"
import hostThemeCss from "@/assets/styles/host-theme.css?raw"
import { highlightName } from "./highlights"

// The page-side styles: the colours of the marks and the pointer over a
// marked word. Adopted into the document, as utils/annotate/styles.ts does,
// never written as inline styles. The colours are the host theme's
// (assets/styles/host-theme.css), carried in this sheet because the theme's
// own sheet only reaches a page that is being translated.

/**
 * On the paragraph of the marked word the pointer is over: the pointer
 * cursor. On the paragraph, not <html>: each change restyles what it is on.
 */
export const DIFFICULT_WORD_HOVER_ATTRIBUTE = "data-read-frog-difficult-word-hover"

function highlightRule(tone: MarkTone, hover: boolean) {
  const token = `--read-frog-highlight-hard${hover ? "-hover" : ""}`
  // Light text on a dark page is lifted with the mark, so it stays readable on it.
  const declarations =
    tone === "dark"
      ? `background-color: var(${token}-dark); color: var(${token}-ink);`
      : `background-color: var(${token});`
  return `::highlight(${highlightName(tone, hover)}) { ${declarations} }`
}

export function buildDifficultWordsDocumentCss(): string {
  const rules = [hostThemeCss]
  for (const tone of ["light", "dark"] as const) {
    rules.push(highlightRule(tone, false), highlightRule(tone, true))
  }
  rules.push(
    `[${DIFFICULT_WORD_HOVER_ATTRIBUTE}], [${DIFFICULT_WORD_HOVER_ATTRIBUTE}] * { cursor: pointer !important; }`,
  )
  return rules.join("\n")
}

let documentSheet: CSSStyleSheet | null = null

export function ensureDifficultWordsDocumentStyles(): void {
  if (!documentSheet) {
    documentSheet = new CSSStyleSheet()
    documentSheet.replaceSync(buildDifficultWordsDocumentCss())
  }
  if (!document.adoptedStyleSheets.includes(documentSheet)) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, documentSheet]
  }
}

export function removeDifficultWordsDocumentStyles(): void {
  if (!documentSheet) return
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
    (sheet) => sheet !== documentSheet,
  )
}
