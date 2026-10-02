import type { WebPageContext } from "@/types/content"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { getDocumentDescription } from "@/utils/content/metadata"
import { logger } from "@/utils/logger"
import { truncateWebPageContent } from "./webpage-content"

export interface CachedWebPageContext extends WebPageContext {
  url: string
  webContent: string
}

let cachedWebPageContext: CachedWebPageContext | null = null

function createDefuddleSnapshotDocument() {
  const clonedDoc = document.implementation.createHTMLDocument(document.title)
  clonedDoc.documentElement.innerHTML = document.documentElement.outerHTML
  return clonedDoc
}

async function extractWebpageContent(): Promise<string> {
  try {
    const { default: Defuddle, createMarkdownContent } = await import("defuddle/full")
    const snapshotDoc = createDefuddleSnapshotDocument()
    const result = new Defuddle(snapshotDoc, {
      separateMarkdown: true,
      url: window.location.href,
      useAsync: false,
    }).parse()

    if (result.contentMarkdown) return result.contentMarkdown
    if (result.content) return createMarkdownContent(result.content, window.location.href)
  } catch (error) {
    logger.warn("Defuddle parsing failed, falling back to body text:", error)
  }
  return document.body?.textContent || ""
}

function splitUrlFragment(url: string): [base: string, fragment: string] {
  const index = url.indexOf("#")
  return index === -1 ? [url, ""] : [url.slice(0, index), url.slice(index + 1)]
}

/**
 * Whether a fragment points into the current document rather than naming an
 * app route: empty, "top", or the id of an element (or name of an `<a>`) on the
 * page — how HTML finds the "indicated part of the document".
 */
function isInPageFragment(fragment: string): boolean {
  if (fragment === "" || fragment.toLowerCase() === "top") {
    return true
  }

  const candidates = [fragment]
  try {
    candidates.push(decodeURIComponent(fragment))
  } catch {
    // A malformed escape cannot name an element; the raw form is still tried.
  }
  return candidates.some(
    (candidate) =>
      document.getElementById(candidate) !== null ||
      Array.from(document.getElementsByName(candidate)).some(
        (element) => element.localName === "a",
      ),
  )
}

/**
 * An in-page anchor jump (a table of contents, a footnote, scroll-spy) stays on
 * the same document, so it keeps the context. Rebuilding would re-parse the
 * whole page, read back the translations already inserted into it as page
 * content, and so re-key the summary and every later paragraph's cache entry.
 * Hash routes (`#/settings`, `#inbox/…`) name no element and still rebuild.
 */
function isInPageAnchorChange(cachedUrl: string, currentUrl: string): boolean {
  const [cachedBase, cachedFragment] = splitUrlFragment(cachedUrl)
  const [currentBase, currentFragment] = splitUrlFragment(currentUrl)
  return (
    cachedBase === currentBase &&
    isInPageFragment(cachedFragment) &&
    isInPageFragment(currentFragment)
  )
}

export async function getOrCreateWebPageContext(): Promise<CachedWebPageContext | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null

  const currentUrl = window.location.href
  if (cachedWebPageContext?.url === currentUrl) {
    return cachedWebPageContext
  }
  if (cachedWebPageContext && isInPageAnchorChange(cachedWebPageContext.url, currentUrl)) {
    cachedWebPageContext = { ...cachedWebPageContext, url: currentUrl }
    return cachedWebPageContext
  }

  cachedWebPageContext = {
    url: currentUrl,
    webTitle: getSourceDocumentTitle(),
    webDescription: getDocumentDescription(document),
    webContent: truncateWebPageContent(await extractWebpageContent()),
  }
  return cachedWebPageContext
}
