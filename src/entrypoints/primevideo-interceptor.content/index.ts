import { defineContentScript } from "#imports"
import { PRIME_VIDEO_MATCHES } from "@/utils/constants/subtitles"
import { setupPlaybackResourcesCapture } from "./playback-resources"
import { listenForSubtitlesRequests, markUnmarkedVideo, watchPlayingTitle } from "./player"

export default defineContentScript({
  matches: PRIME_VIDEO_MATCHES,
  world: "MAIN",
  runAt: "document_start",
  main() {
    if ((window as any).__READ_FROG_PRIME_VIDEO_INTERCEPTOR_INJECTED__) {
      return
    }
    ;(window as any).__READ_FROG_PRIME_VIDEO_INTERCEPTOR_INJECTED__ = true

    setupPlaybackResourcesCapture(markUnmarkedVideo)
    watchPlayingTitle()
    listenForSubtitlesRequests()
  },
})
