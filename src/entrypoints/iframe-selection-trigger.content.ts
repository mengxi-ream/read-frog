import { defineContentScript } from "#imports"
import { isReadFrogEbookSection } from "@/utils/ebook-section"
import { registerIframeSelectionTrigger } from "@/utils/iframe-selection-trigger"
import { sendMessage } from "@/utils/message"

export default defineContentScript({
  matches: ["*://*/*"],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  main(ctx) {
    if (window === window.top || window.origin === "null") return
    // A Read Frog ebook section: the reader bridges its selections to the
    // top frame's toolbar, and ebook-section.content.ts brings it page
    // translation.
    if (isReadFrogEbookSection(document)) return
    try {
      // Browser access checks reject opaque sandbox origins too. Blank/srcdoc
      // frames inherit an origin even though location.origin can be "null".
      if (window.top?.location.origin !== window.origin) return
    } catch {
      return
    }

    ctx.onInvalidated(
      registerIframeSelectionTrigger({
        requestRuntime: () => sendMessage("activateSameOriginIframeSelectionRuntime", undefined),
        isRuntimeInjected: () => window.__READ_FROG_SELECTION_INJECTED__ === true,
      }),
    )
  },
})
