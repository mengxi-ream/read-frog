import type { ContentScriptContext } from "#imports"
import type { YoutubeMode } from "./platforms/youtube/config"
import {
  YOUTUBE_EMBED_PATH_PATTERN,
  YOUTUBE_LIVE_PATH_PATTERN,
  YOUTUBE_NAVIGATE_FINISH_EVENT,
  YOUTUBE_SHORTS_PATH_PATTERN,
  YOUTUBE_WATCH_URL_PATTERN,
} from "@/utils/constants/subtitles"
import { logger } from "@/utils/logger"
import { bindSubtitlesToggleShortcut } from "./bind-subtitles-toggle-shortcut"
import { createYoutubeSubtitlesAdapter } from "./platforms/youtube"
import { createYoutubeCaptionTrackListener } from "./platforms/youtube/caption-track-listener"
import { getYoutubeConfig } from "./platforms/youtube/config"
import { watchShortsActiveReel } from "./platforms/youtube/shorts-active-reel-watcher"
import { createShortsTranslateButtonMount } from "./renderer/mount-shorts-translate-button"
import { mountSubtitlesSidebar, unmountSubtitlesSidebar } from "./renderer/mount-subtitles-sidebar"
import { mountSubtitlesUI, unmountSubtitlesUI } from "./renderer/mount-subtitles-ui"

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

/** The player layout the current URL shows, or null where YouTube has no player to translate. */
function resolveYoutubeMode(): YoutubeMode | null {
  if (isYoutubeEmbed()) return "embed"
  if (isYoutubeShorts()) return "shorts"
  if (isYoutubeWatch() || isYoutubeLive()) return "watch"
  return null
}

interface YoutubeSession {
  mode: YoutubeMode
  adapter: ReturnType<typeof createYoutubeSubtitlesAdapter>
  teardown: () => void
}

/**
 * YouTube is one document whose player layout changes with the URL: the watch page,
 * Shorts and embeds each put the video and its controls somewhere else. Each layout
 * gets its own adapter and UI, and a navigation that lands on a different layout tears
 * the previous ones down first, so entering Shorts from the feed (or leaving it for a
 * watch page) mounts the same as a cold load of that URL would.
 */
export function initYoutubeSubtitles(ctx: ContentScriptContext) {
  let session: YoutubeSession | null = null
  // Navigations are applied one at a time: a session still waiting for its player
  // must not be torn down underneath, or a second one started beside it.
  let queue: Promise<void> = Promise.resolve()

  const teardownSession = () => {
    session?.teardown()
    session = null
  }

  const startSession = async (mode: YoutubeMode) => {
    const config = getYoutubeConfig({ mode })
    const adapter = createYoutubeSubtitlesAdapter(config)
    const disposers: Array<() => void> = [
      () => adapter.destroy(),
      unmountSubtitlesUI,
      unmountSubtitlesSidebar,
    ]
    const current: YoutubeSession = {
      mode,
      adapter,
      teardown: () => {
        for (const dispose of disposers.splice(0).reverse()) dispose()
      },
    }
    session = current
    const isCurrent = () => session === current

    await mountSubtitlesUI({ adapter, config, menuBelow: mode === "shorts" })
    if (!isCurrent()) {
      // Invalidated while waiting for the player: nothing else of this session is live.
      unmountSubtitlesUI()
      return
    }
    mountSubtitlesSidebar(adapter)

    const unbindToggleShortcut = await bindSubtitlesToggleShortcut(adapter)
    if (!isCurrent()) {
      unbindToggleShortcut()
      return
    }
    disposers.push(unbindToggleShortcut)

    const trackListener = createYoutubeCaptionTrackListener({
      playerContainerSelector: config.selectors.playerContainer,
      onTrackChanged: () => {
        void adapter.handleSourceTrackChanged()
      },
    })
    trackListener.start()
    disposers.push(() => trackListener.stop())
    void adapter.initialize()

    if (mode === "shorts") {
      // Shorts reuse one player across reels, so the adapter learns about the next
      // reel from the DOM rather than from YouTube's navigation events.
      const button = createShortsTranslateButtonMount(adapter)
      void button.mount()
      const unwatchReel = watchShortsActiveReel(() => {
        void button.mount()
        adapter.notifyNavigation()
      })
      disposers.push(unwatchReel, button.dispose)
    }
  }

  const syncSession = async () => {
    const mode = resolveYoutubeMode()
    if (!mode) {
      // No player on this page; a session from before keeps handling its own
      // navigation, the same as when YouTube returns to it.
      return
    }

    if (session?.mode === mode) {
      // Same layout: keep the adapter and make sure the overlay follows the player.
      await mountSubtitlesUI({
        adapter: session.adapter,
        config: getYoutubeConfig({ mode }),
        menuBelow: mode === "shorts",
      })
      mountSubtitlesSidebar(session.adapter)
      return
    }

    teardownSession()
    await startSession(mode)
  }

  const tryInit = () => {
    queue = queue.then(syncSession).catch((error) => {
      logger.error("[subtitles] failed to sync the YouTube subtitles session", error)
    })
  }

  tryInit()
  ctx.onInvalidated(teardownSession)

  // An embed is its own frame and never navigates; everything else is the YouTube SPA.
  if (!isYoutubeEmbed()) {
    window.addEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, tryInit)
    ctx.onInvalidated(() => window.removeEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, tryInit))
  }
}
