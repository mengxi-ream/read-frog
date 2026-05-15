import { YOUTUBE_EMBED_PATH_PATTERN, YOUTUBE_NAVIGATE_FINISH_EVENT, YOUTUBE_WATCH_URL_PATTERN } from "@/utils/constants/subtitles"
import { createYoutubeSubtitlesAdapter } from "./platforms/youtube"
import { createYoutubeCaptionTrackListener } from "./platforms/youtube/caption-track-listener"
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
  let adapter: ReturnType<typeof createYoutubeSubtitlesAdapter> | null = null

  const embedded = isYoutubeEmbed()
  const config = getYoutubeConfig({ embedded })

  const tryInit = async () => {
    if (!isYoutubeWatch() && !embedded) {
      return
    }

    if (!adapter) {
      adapter = createYoutubeSubtitlesAdapter(config)
    }

    if (!adapter) {
      return
    }

    await mountSubtitlesUI({ adapter, config })

    if (initialized) {
      return
    }

    initialized = true
    const trackListener = createYoutubeCaptionTrackListener({
      playerContainerSelector: config.selectors.playerContainer,
      onTrackChanged: () => {
        void adapter?.handleSourceTrackChanged()
      },
    })
    trackListener.start()
    void adapter.initialize()
  }

  void tryInit()

  if (!embedded) {
    window.addEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, () => void tryInit())
  }
}
