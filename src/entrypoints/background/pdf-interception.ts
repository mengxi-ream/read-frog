import type { Config } from "@/types/config/config"
import { browser } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"

const PDF_VIEWER_PATH = "/pdf-viewer.html" as const

/** Fast first-pass: does the URL path obviously end in .pdf? */
function isPdfUrl(url: string | undefined | null): boolean {
  try {
    return new URL(url ?? "").pathname.toLowerCase().endsWith(".pdf")
  } catch {
    return false
  }
}

/** Does the response carry a `Content-Type: application/pdf` header? */
function isPdfContentType(headers: Array<{ name: string; value?: string }> | undefined): boolean {
  return (
    headers?.some(
      (h) =>
        h.name.toLowerCase() === "content-type" &&
        h.value?.toLowerCase().includes("application/pdf"),
    ) ?? false
  )
}

/**
 * Set up PDF URL interception using two strategies:
 *
 * 1. **URL-based** (`webNavigation.onBeforeNavigate`): Fast redirect for URLs
 *    that obviously end in `.pdf`. Happens before the request is sent.
 *
 * 2. **Content-type-based** (`webRequest.onHeadersReceived`): Catches PDFs
 *    served from URLs that don't end in `.pdf` (e.g. arxiv.org/pdf/1706.03762)
 *    by checking the `Content-Type: application/pdf` response header.
 */
export function setupPdfInterception() {
  // Strategy 1: URL-based fast redirect
  browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) return
    if (!details.url) return
    if (details.url.includes(browser.runtime.getURL(""))) return
    if (!isPdfUrl(details.url)) return

    const config: Config | null = await getLocalConfig()
    if (!config?.pdfTranslation?.enabled) return

    const viewerUrl = `${browser.runtime.getURL(PDF_VIEWER_PATH)}?url=${encodeURIComponent(details.url)}`

    logger.info("Intercepting PDF navigation (URL match), redirecting to viewer", {
      originalUrl: details.url,
    })

    await browser.tabs.update(details.tabId, { url: viewerUrl })
  })

  // Strategy 2: Content-type-based detection for non-.pdf URLs
  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.frameId !== 0) return
      if (!details.url) return
      if (details.url.includes(browser.runtime.getURL(""))) return
      // Skip URLs that obviously end in .pdf (already handled by strategy 1)
      if (isPdfUrl(details.url)) return
      if (!isPdfContentType(details.responseHeaders)) return

      // Fire-and-forget the async redirect — the listener itself must return synchronously
      void (async () => {
        const config: Config | null = await getLocalConfig()
        if (!config?.pdfTranslation?.enabled) return

        const viewerUrl = `${browser.runtime.getURL(PDF_VIEWER_PATH)}?url=${encodeURIComponent(details.url)}`

        logger.info("Intercepting PDF navigation (content-type match), redirecting to viewer", {
          originalUrl: details.url,
        })

        await browser.tabs.update(details.tabId, { url: viewerUrl })
      })()
    },
    { urls: ["<all_urls>"], types: ["main_frame"] },
    ["responseHeaders"],
  )
}
