import { defineContentScript } from "#imports"
import { env } from "@/env"
import { runContentLoader } from "@/utils/content-runtime/loader"
import { isReadFrogEbookSection } from "@/utils/ebook-section"
import { SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"

/**
 * Page translation inside the readfrog.app ebook reader. The reader renders
 * each book section in a sandboxed blob: iframe, and Chrome's webNavigation
 * API leaves blob: frames out of `getAllFrames` and its events, so the
 * background's iframe injection (translation-signal.ts) never reaches them.
 * A content script with `matchOriginAsFallback` does: blob: documents match
 * through the origin that created them. It runs the host part only; the
 * reader relays selections to the top frame's toolbar through the ebook
 * selection bridge, so the selection runtime stays out (see
 * iframe-selection-trigger.content.ts).
 */
export default defineContentScript({
  matches: env.WXT_OFFICIAL_SITE_ORIGINS.map((origin: string) => `${origin}/*`),
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  async main() {
    if (window === window.top || !isReadFrogEbookSection(document)) return

    // Site control follows the reader page, as it does for the frames the
    // background injects: a blob: URL matches no site pattern of its own.
    try {
      const pageUrl = window.top?.location.href
      if (pageUrl) {
        ;(globalThis as Record<string, unknown>)[SITE_CONTROL_URL_WINDOW_KEY] = pageUrl
      }
    } catch {
      // A cross-origin top frame cannot be a Read Frog reader page.
      return
    }

    await runContentLoader(["host"])
  },
})
