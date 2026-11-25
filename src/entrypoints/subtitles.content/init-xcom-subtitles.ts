import type { ContentScriptContext } from "#imports"
import { XCOM_STATUS_POLL_INTERVAL_MS } from "@/utils/constants/subtitles"
import { bindSubtitlesToggleShortcut } from "./bind-subtitles-toggle-shortcut"
import { createXcomSubtitlesAdapter } from "./platforms/xcom"
import { getXcomConfig } from "./platforms/xcom/config"
import {
  getCurrentPrimaryXcomStatusVideo,
  getCurrentXcomVideoId,
  getXcomStatusVideoContainer,
  isXcomCandidatePlayer,
} from "./platforms/xcom/dom"
import {
  clearXcomOverlayEntryPoints,
  ensureXcomOverlayEntryPoint,
  mountXcomTranslateButton,
} from "./platforms/xcom/overlay-entry"
import { watchXcomPlayer } from "./platforms/xcom/watch-player"
import { mountSubtitlesSidebar } from "./renderer/mount-subtitles-sidebar"
import { mountSubtitlesUI, unmountSubtitlesUI } from "./renderer/mount-subtitles-ui"

function isXcomHost(): boolean {
  const { hostname } = window.location
  return (
    hostname === "x.com" ||
    hostname.endsWith(".x.com") ||
    hostname === "twitter.com" ||
    hostname.endsWith(".twitter.com")
  )
}

function getCurrentVideoContainer(): HTMLElement | null {
  const video = getCurrentPrimaryXcomStatusVideo()
  return video ? getXcomStatusVideoContainer(video) : null
}

function isPlayingIn(container: HTMLElement | null): boolean {
  return container?.querySelector("video")?.paused === false
}

export function initXcomSubtitles(ctx: ContentScriptContext) {
  if (!isXcomHost()) {
    return
  }

  const config = getXcomConfig()
  let adapter: ReturnType<typeof createXcomSubtitlesAdapter> | null = null
  let initialized = false
  let lastVideoId: string | null = null
  let lastVideoContainer: HTMLElement | null = null

  // Passing over another video keeps the AI subtitles a reader waits for; playing it instead lets go.
  // So does a player the media view hides or slides away, whose video no longer resolves.
  const getActiveVideoContainer = () => {
    const current = getCurrentVideoContainer()
    const keepsPinned =
      adapter?.isAwaitingAiSubtitles() &&
      isXcomCandidatePlayer(lastVideoContainer) &&
      (isPlayingIn(lastVideoContainer) || !isPlayingIn(current))
    return keepsPinned ? lastVideoContainer : current
  }

  const remount = async (activeAdapter: NonNullable<typeof adapter>) => {
    lastVideoContainer = getActiveVideoContainer()
    lastVideoId = getCurrentXcomVideoId()
    await mountSubtitlesUI({ adapter: activeAdapter, config })
    activeAdapter.notifyNavigation()
  }

  const syncEntryPoint = () => {
    const videoContainer = getActiveVideoContainer()
    if (!adapter || !ensureXcomOverlayEntryPoint(videoContainer)) {
      return
    }

    mountXcomTranslateButton(adapter)

    if (initialized && videoContainer !== lastVideoContainer) {
      void remount(adapter)
    }
  }

  ctx.onInvalidated(watchXcomPlayer(syncEntryPoint))

  const tryInit = async () => {
    if (!ensureXcomOverlayEntryPoint(getActiveVideoContainer())) {
      return
    }

    adapter ??= createXcomSubtitlesAdapter(config)
    await mountSubtitlesUI({ adapter, config })
    mountSubtitlesSidebar(adapter)

    lastVideoId = getCurrentXcomVideoId()
    lastVideoContainer = getActiveVideoContainer()

    if (initialized) {
      return
    }

    initialized = true
    const unbindToggleShortcut = await bindSubtitlesToggleShortcut(adapter)
    ctx.onInvalidated(unbindToggleShortcut)
    void adapter.initialize()
  }

  void tryInit()

  const intervalId = setInterval(() => {
    const videoContainer = getActiveVideoContainer()
    if (!videoContainer) {
      // Or the overlay's React root stays alive inside a discarded player.
      clearXcomOverlayEntryPoints()
      if (lastVideoContainer) {
        unmountSubtitlesUI()
        // A leave, not a navigation: a navigation would wait for a player and report it missing.
        adapter?.notifyLeave()
      }
      lastVideoId = null
      lastVideoContainer = null
      return
    }

    if (!adapter || !initialized) {
      void tryInit()
      return
    }

    const videoId = getCurrentXcomVideoId()
    if (videoId === lastVideoId && videoContainer === lastVideoContainer) {
      syncEntryPoint()
      return
    }

    if (ensureXcomOverlayEntryPoint(videoContainer)) {
      void remount(adapter)
    }
  }, XCOM_STATUS_POLL_INTERVAL_MS)

  ctx.onInvalidated(() => clearInterval(intervalId))
}
