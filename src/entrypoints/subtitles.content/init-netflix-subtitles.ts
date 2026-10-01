import type { ContentScriptContext } from "#imports"
import {
  NETFLIX_PLAYER_SELECTOR,
  NETFLIX_WATCH_POLL_INTERVAL_MS,
} from "@/utils/constants/subtitles"
import { NetflixSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { getNetflixMovieId } from "@/utils/subtitles/video-id"
import { bindSubtitlesToggleShortcut } from "./bind-subtitles-toggle-shortcut"
import { getNetflixConfig } from "./platforms/netflix/config"
import {
  mountNetflixTranslateButton,
  removeNetflixTranslateButton,
  watchNetflixControls,
} from "./platforms/netflix/translate-button"
import { mountSubtitlesSidebar } from "./renderer/mount-subtitles-sidebar"
import { mountSubtitlesUI, unmountSubtitlesUI } from "./renderer/mount-subtitles-ui"
import { UniversalVideoAdapter } from "./universal-adapter"

export function initNetflixSubtitles(ctx: ContentScriptContext) {
  if (window.location.hostname !== "www.netflix.com") {
    return
  }

  const config = getNetflixConfig()
  const adapter = new UniversalVideoAdapter({
    config,
    fetchers: { native: () => new NetflixSubtitlesFetcher() },
  })
  let initPromise: Promise<void> | null = null
  let initialized = false
  let lastMovieId: string | null = null
  let lastPlayer: HTMLElement | null = null

  const mount = async () => {
    lastMovieId = getNetflixMovieId()
    lastPlayer = document.querySelector<HTMLElement>(NETFLIX_PLAYER_SELECTOR)
    await mountSubtitlesUI({ adapter, config })
    mountNetflixTranslateButton(adapter)
  }

  const init = async () => {
    await mount()
    mountSubtitlesSidebar(adapter)
    ctx.onInvalidated(await bindSubtitlesToggleShortcut(adapter))
    initialized = true
    void adapter.initialize()
  }

  ctx.onInvalidated(
    watchNetflixControls(() => {
      if (initialized) mountNetflixTranslateButton(adapter)
    }),
  )

  const tick = () => {
    const movieId = getNetflixMovieId()
    const player = document.querySelector<HTMLElement>(NETFLIX_PLAYER_SELECTOR)

    if (!movieId || !player) {
      if (lastPlayer) {
        removeNetflixTranslateButton()
        unmountSubtitlesUI()
        adapter.notifyNavigation()
      }
      lastMovieId = null
      lastPlayer = null
      return
    }

    if (!initialized) {
      initPromise ??= init()
      return
    }

    if (movieId !== lastMovieId || player !== lastPlayer) {
      void mount().then(() => adapter.notifyNavigation())
      return
    }

    void adapter.handleSourceTrackChanged()
  }

  tick()
  const intervalId = setInterval(tick, NETFLIX_WATCH_POLL_INTERVAL_MS)
  ctx.onInvalidated(() => clearInterval(intervalId))
}
