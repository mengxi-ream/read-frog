/**
 * The readfrog.app ebook reader sets this on the `<html>` of every book
 * section it renders: each section is a sandboxed blob: iframe inside the
 * reader frame (`EBOOK_SECTION_DOCUMENT_ATTRIBUTE` in `@read-frog/definitions`;
 * spelled out here until that release ships). Chrome's webNavigation API does
 * not list blob: frames, so the background's iframe injection never sees
 * them: the ebook section content script reaches them instead, and the
 * selection runtime stays out because the reader relays selections to the
 * top frame through the ebook selection bridge.
 */
const EBOOK_SECTION_DOCUMENT_ATTRIBUTE = "data-read-frog-ebook-section"

export function isReadFrogEbookSection(doc: Document): boolean {
  return doc.documentElement?.hasAttribute(EBOOK_SECTION_DOCUMENT_ATTRIBUTE) ?? false
}
