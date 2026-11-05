import type { ContentScriptContext } from "#imports"
import { TrackSubtitlesFetcher, udemyTrackSource } from "@/utils/subtitles/fetchers"
import { getUdemyConfig } from "./platforms/udemy/config"
import {
  mountUdemyTranslateButton,
  removeUdemyTranslateButton,
} from "./platforms/udemy/translate-button"
import { pollPlayerSubtitles } from "./poll-player-subtitles"
import { UniversalVideoAdapter } from "./universal-adapter"

// Udemy Business serves each company's courses on its own subdomain.
function isUdemyHost(): boolean {
  const { hostname } = window.location
  return hostname === "udemy.com" || hostname.endsWith(".udemy.com")
}

export function initUdemySubtitles(ctx: ContentScriptContext) {
  if (!isUdemyHost()) {
    return
  }

  const config = getUdemyConfig()
  const adapter = new UniversalVideoAdapter({
    config,
    fetchers: { native: () => new TrackSubtitlesFetcher(udemyTrackSource) },
  })
  pollPlayerSubtitles(ctx, {
    adapter,
    config,
    onStay: () => mountUdemyTranslateButton(adapter),
    onLeave: removeUdemyTranslateButton,
  })
}
