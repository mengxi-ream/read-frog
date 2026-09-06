import type { ContentScriptContext } from "#imports"
import {
  YOUTUBE_EMBED_PATH_PATTERN,
  YOUTUBE_LIVE_PATH_PATTERN,
  YOUTUBE_NAVIGATE_FINISH_EVENT,
  YOUTUBE_SHORTS_PATH_PATTERN,
  YOUTUBE_WATCH_URL_PATTERN,
} from "@/utils/constants/subtitles"
import { bindSubtitlesToggleShortcut } from "./bind-subtitles-toggle-shortcut"
import { createYoutubeSubtitlesAdapter } from "./platforms/youtube"
import { createYoutubeCaptionTrackListener } from "./platforms/youtube/caption-track-listener"
import { getYoutubeConfig } from "./platforms/youtube/config"
import { watchShortsActiveReel } from "./platforms/youtube/shorts-active-reel-watcher"
import { mountShortsTranslateButton } from "./renderer/mount-shorts-translate-button"
import { mountSubtitlesSidebar } from "./renderer/mount-subtitles-sidebar"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"

function isYoutubeWatch(): boolean {
  return window.location.href.includes(YOUTUBE_WATCH_URL_PATTERN)
}

function isYoutubeLive(): boolean {
  return YOUTUBE_LIVE_PATH_PATTERN.test(window.location.pathname)
}

function isYoutubeEmbed(): boolean {
  return YOUTUBE_EMBED_PATH_PATTERN.test(window.location.pathname)
}

function isYoutubeShorts(): boolean {
  return YOUTUBE_SHORTS_PATH_PATTERN.test(window.location.pathname)
}

export function initYoutubeSubtitles(ctx: ContentScriptContext) {
  let initialized = false
  let adapter: ReturnType<typeof createYoutubeSubtitlesAdapter> | null = null

  const shorts = isYoutubeShorts()
  const embedded = isYoutubeEmbed()
  const mode = shorts ? "shorts" : embedded ? "embed" : "watch"
  const config = getYoutubeConfig({ mode })

  const tryInit = async () => {
    if (!isYoutubeWatch() && !isYoutubeLive() && !embedded && !shorts) {
      return
    }

    if (!adapter) {
      adapter = createYoutubeSubtitlesAdapter(config)
    }

    if (!adapter) {
      return
    }

    await mountSubtitlesUI({ adapter, config, menuBelow: shorts })
    mountSubtitlesSidebar(adapter)

    if (initialized) {
      return
    }

    initialized = true
    const unbindToggleShortcut = await bindSubtitlesToggleShortcut(adapter)
    ctx.onInvalidated(unbindToggleShortcut)

    const trackListener = createYoutubeCaptionTrackListener({
      playerContainerSelector: config.selectors.playerContainer,
      onTrackChanged: () => {
        void adapter?.handleSourceTrackChanged()
      },
    })
    trackListener.start()
    void adapter.initialize()

    if (shorts) {
      const shortsAdapter = adapter
      void mountShortsTranslateButton(shortsAdapter)
      watchShortsActiveReel(() => {
        void mountShortsTranslateButton(shortsAdapter)
        shortsAdapter.notifyNavigation()
      })
    }
  }

  void tryInit()

  if (!embedded && !shorts) {
    window.addEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, () => void tryInit())
  }
}
