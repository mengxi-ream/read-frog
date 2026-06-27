import { defineContentScript } from "#imports"
import { injectPlayerApi } from "./inject-player-api"
import { injectStreamingSubtitlesInterceptor } from "./streaming-subtitles-interceptor"

export default defineContentScript({
  matches: ["*://*.youtube.com/*", "*://*.youtube-nocookie.com/*", "*://*.netflix.com/*"],
  allFrames: true,
  world: "MAIN",
  runAt: "document_start",
  main() {
    if (/(?:^|\.)youtube(?:-nocookie)?\.com$/i.test(window.location.hostname))
      injectPlayerApi()
    injectStreamingSubtitlesInterceptor()
  },
})
