import { initStreamingSubtitles } from "./init-streaming-subtitles"
import { initYoutubeSubtitles } from "./init-youtube-subtitles"

let hasBootstrappedSubtitlesRuntime = false

export function bootstrapSubtitlesRuntime() {
  if (hasBootstrappedSubtitlesRuntime) {
    return
  }

  hasBootstrappedSubtitlesRuntime = true

  if (/(?:^|\.)youtube(?:-nocookie)?\.com$/i.test(window.location.hostname)) {
    initYoutubeSubtitles()
    return
  }

  void initStreamingSubtitles()
}
