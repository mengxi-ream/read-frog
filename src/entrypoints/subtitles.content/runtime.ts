import { initNetflixSubtitles } from "./init-netflix-subtitles"
import { initYoutubeSubtitles } from "./init-youtube-subtitles"

let hasBootstrappedSubtitlesRuntime = false

export function bootstrapSubtitlesRuntime() {
  if (hasBootstrappedSubtitlesRuntime) {
    return
  }

  hasBootstrappedSubtitlesRuntime = true
  if (/(?:^|\.)netflix\.com$/i.test(window.location.hostname))
    void initNetflixSubtitles()
  else
    initYoutubeSubtitles()
}
