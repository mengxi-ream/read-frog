import type { ContentScriptContext } from "#imports"
import type { PlatformConfig } from "./platforms"
import type { UniversalVideoAdapter } from "./universal-adapter"
import { PLAYER_WATCH_POLL_INTERVAL_MS } from "@/utils/constants/subtitles"
import { bindSubtitlesToggleShortcut } from "./bind-subtitles-toggle-shortcut"
import { mountSubtitlesSidebar } from "./renderer/mount-subtitles-sidebar"
import { mountSubtitlesUI, unmountSubtitlesUI } from "./renderer/mount-subtitles-ui"

interface PollPlayerOptions {
  adapter: UniversalVideoAdapter
  config: PlatformConfig
}

interface MountedPlayer {
  videoId: string
  player: HTMLElement
}

/** Mounts subtitles on a site that changes videos without a page load or an event. */
export function pollPlayerSubtitles(
  ctx: ContentScriptContext,
  { adapter, config }: PollPlayerOptions,
) {
  let initPromise: Promise<void> | null = null
  let initialized = false
  let mounted: MountedPlayer | null = null

  const mount = async (current: MountedPlayer) => {
    mounted = current
    await mountSubtitlesUI({ adapter, config })
  }

  const init = async (current: MountedPlayer) => {
    await mount(current)
    mountSubtitlesSidebar(adapter)
    // Before the shortcut's config read, so a leave during that read meets a running init.
    initialized = true
    void adapter.initialize()
    ctx.onInvalidated(await bindSubtitlesToggleShortcut(adapter))
  }

  const tick = () => {
    const videoId = config.getVideoId?.() ?? null
    const player = document.querySelector<HTMLElement>(config.selectors.playerContainer)

    if (!videoId || !player) {
      if (mounted) {
        unmountSubtitlesUI()
        adapter.notifyLeave()
      }
      mounted = null
      return
    }

    if (!initialized) {
      initPromise ??= init({ videoId, player })
      return
    }

    if (videoId !== mounted?.videoId || player !== mounted.player) {
      void mount({ videoId, player }).then(() => adapter.notifyNavigation())
    }
  }

  tick()
  const intervalId = setInterval(tick, PLAYER_WATCH_POLL_INTERVAL_MS)
  // The url changes only once the next video loads, so playback starting is the first sign.
  document.addEventListener("playing", tick, true)
  ctx.onInvalidated(() => {
    clearInterval(intervalId)
    document.removeEventListener("playing", tick, true)
  })
}
