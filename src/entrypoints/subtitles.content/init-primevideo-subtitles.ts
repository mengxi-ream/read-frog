import type { ContentScriptContext } from "#imports"
import { primeVideoTrackSource, TrackSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { getSubtitlesPlatformForHostname } from "@/utils/subtitles/platform-host"
import { getPrimeVideoConfig } from "./platforms/primevideo/config"
import {
  mountPrimeVideoTranslateButton,
  removePrimeVideoTranslateButton,
} from "./platforms/primevideo/translate-button"
import { pollPlayerSubtitles } from "./poll-player-subtitles"
import { UniversalVideoAdapter } from "./universal-adapter"
import { watchDomChanges } from "./watch-dom-changes"

export function initPrimeVideoSubtitles(ctx: ContentScriptContext) {
  if (getSubtitlesPlatformForHostname(window.location.hostname) !== "primevideo") {
    return
  }

  const config = getPrimeVideoConfig()
  const adapter = new UniversalVideoAdapter({
    config,
    fetchers: { native: () => new TrackSubtitlesFetcher(primeVideoTrackSource) },
  })
  let onPlayer = false

  // Prime takes its controls out of the page while they hide, so the button goes back as they show.
  ctx.onInvalidated(
    watchDomChanges(() => {
      if (onPlayer) mountPrimeVideoTranslateButton(adapter)
    }),
  )
  pollPlayerSubtitles(ctx, {
    adapter,
    config,
    menuBelow: true,
    onStay: () => {
      onPlayer = true
      mountPrimeVideoTranslateButton(adapter)
    },
    onLeave: () => {
      onPlayer = false
      removePrimeVideoTranslateButton()
    },
  })
}
