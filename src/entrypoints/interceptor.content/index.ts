import { defineContentScript } from "#imports"
import { injectPlayerApi } from "./inject-player-api"

export default defineContentScript({
  matches: ["*://*.youtube.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    injectPlayerApi()
  },
})
