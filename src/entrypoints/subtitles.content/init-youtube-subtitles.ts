import { YOUTUBE_EMBED_PATH_PATTERN, YOUTUBE_NAVIGATE_FINISH_EVENT, YOUTUBE_WATCH_URL_PATTERN } from "@/utils/constants/subtitles"
import { setupYoutubeSubtitles } from "./platforms/youtube"
import { getYoutubeConfig } from "./platforms/youtube/config"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"

function isYoutubeWatch(): boolean {
  return window.location.href.includes(YOUTUBE_WATCH_URL_PATTERN)
}

function isYoutubeEmbed(): boolean {
  return YOUTUBE_EMBED_PATH_PATTERN.test(window.location.pathname)
}

export function initYoutubeSubtitles() {
  let initialized = false
  let mountedAdapter: ReturnType<typeof setupYoutubeSubtitles> | null = null

  const embedded = isYoutubeEmbed()
  const config = getYoutubeConfig({ embedded })

  const tryInit = async () => {
    if (!isYoutubeWatch() && !embedded) {
      return
    }

    if (!mountedAdapter) {
      mountedAdapter = setupYoutubeSubtitles(config)
    }

    await mountSubtitlesUI({ adapter: mountedAdapter, config })

    if (initialized) {
      return
    }

    initialized = true
    void mountedAdapter.initialize()
  }

  void tryInit()

  if (!embedded) {
    window.addEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, () => void tryInit())
  }
}
