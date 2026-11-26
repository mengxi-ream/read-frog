import { defineContentScript } from "#imports"
import { listenForSubtitlesRequests } from "./player"
import { setupPlayerInfoCapture } from "./player-info-capture"

export default defineContentScript({
  matches: ["*://www.bilibili.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    if ((window as any).__READ_FROG_BILIBILI_INTERCEPTOR_INJECTED__) {
      return
    }
    ;(window as any).__READ_FROG_BILIBILI_INTERCEPTOR_INJECTED__ = true

    setupPlayerInfoCapture()
    listenForSubtitlesRequests()
  },
})
