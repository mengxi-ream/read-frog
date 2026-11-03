import type { MarkKind, MarkTone } from "./highlights"
import hostThemeCss from "@/assets/styles/host-theme.css?raw"
import { highlightName } from "./highlights"

// The page-side styles: the colours of the marks and the pointer over a
// marked word. Adopted into the document, as utils/annotate/styles.ts does,
// never written as inline styles. The colours are the host theme's
// (assets/styles/host-theme.css), carried in this sheet because the theme's
// own sheet only reaches a page that is being translated.

/** On <html> while the pointer is over a marked word: the pointer cursor. */
export const DIFFICULT_WORD_HOVER_ATTRIBUTE = "data-read-frog-difficult-word-hover"

function highlightRule(kind: MarkKind, tone: MarkTone, hover: boolean) {
  const token = `--read-frog-highlight-${kind}${hover ? "-hover" : ""}`
  // Light text on a dark page is lifted with the mark, so it stays readable on it.
  const declarations =
    tone === "dark"
      ? `background-color: var(${token}-dark); color: var(${token}-ink);`
      : `background-color: var(${token});`
  return `::highlight(${highlightName(kind, tone, hover)}) { ${declarations} }`
}

export function buildDifficultWordsDocumentCss(): string {
  const rules = [hostThemeCss]
  for (const kind of ["hard", "learning"] as const) {
    for (const tone of ["light", "dark"] as const) {
      rules.push(highlightRule(kind, tone, false), highlightRule(kind, tone, true))
    }
  }
  rules.push(
    `html[${DIFFICULT_WORD_HOVER_ATTRIBUTE}], html[${DIFFICULT_WORD_HOVER_ATTRIBUTE}] * { cursor: pointer !important; }`,
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
