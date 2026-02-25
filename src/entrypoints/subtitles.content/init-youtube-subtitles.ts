import { YOUTUBE_NAVIGATE_EVENT, YOUTUBE_WATCH_URL_PATTERN } from "@/utils/constants/subtitles"
import { setupYoutubeSubtitles } from "./platforms/youtube"
import { youtubeConfig } from "./platforms/youtube/config"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"

export function initYoutubeSubtitles() {
  let initialized = false

  const tryInit = async () => {
    if (!window.location.href.includes(YOUTUBE_WATCH_URL_PATTERN)) {
      return
    }
    if (initialized) {
      return
    }
    initialized = true

    await mountSubtitlesUI(youtubeConfig)
    setupYoutubeSubtitles()
  }

  void tryInit()

  window.addEventListener(YOUTUBE_NAVIGATE_EVENT, () => void tryInit())
}
