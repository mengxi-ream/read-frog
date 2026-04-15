import { YOUTUBE_NAVIGATE_FINISH_EVENT, YOUTUBE_WATCH_URL_PATTERN } from "@/utils/constants/subtitles"
import { setupYoutubeSubtitles } from "./platforms/youtube"
import { youtubeConfig } from "./platforms/youtube/config"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"

export function initYoutubeSubtitles() {
  let initialized = false
  let mountedAdapter: ReturnType<typeof setupYoutubeSubtitles> | null = null

  const tryInit = async () => {
    if (!window.location.href.includes(YOUTUBE_WATCH_URL_PATTERN)) {
      return
    }

    if (!mountedAdapter) {
      mountedAdapter = setupYoutubeSubtitles()
    }

    await mountSubtitlesUI({ adapter: mountedAdapter, config: youtubeConfig })

    if (initialized) {
      return
    }

    initialized = true
    void mountedAdapter.initialize()
  }

  void tryInit()

  window.addEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, () => void tryInit())
}
