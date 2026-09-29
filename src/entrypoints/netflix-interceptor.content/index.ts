import { defineContentScript } from "#imports"
import { listenForSubtitlesRequests } from "./player"
import { setupTtmlCapture } from "./ttml-capture"

export default defineContentScript({
  matches: ["*://www.netflix.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    if ((window as any).__READ_FROG_NETFLIX_INTERCEPTOR_INJECTED__) {
      return
    }
    ;(window as any).__READ_FROG_NETFLIX_INTERCEPTOR_INJECTED__ = true

    setupTtmlCapture()
    listenForSubtitlesRequests()
  },
})
