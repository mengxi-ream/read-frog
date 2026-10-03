import { defineContentScript } from "#imports"
import { registerIframeSelectionTrigger } from "@/utils/iframe-selection-trigger"
import { sendMessage } from "@/utils/message"

export default defineContentScript({
  matches: ["*://*/*"],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  main(ctx) {
    if (window === window.top || window.origin === "null") return
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
