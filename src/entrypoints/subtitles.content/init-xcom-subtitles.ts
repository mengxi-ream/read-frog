import type { ContentScriptContext } from "#imports"
import { XCOM_STATUS_POLL_INTERVAL_MS } from "@/utils/constants/subtitles"
import { getXcomStatusId } from "@/utils/subtitles/video-id"
import { bindSubtitlesToggleShortcut } from "./bind-subtitles-toggle-shortcut"
import { createXcomSubtitlesAdapter } from "./platforms/xcom"
import { getXcomConfig } from "./platforms/xcom/config"
import { getCurrentPrimaryXcomStatusVideo, getXcomStatusVideoContainer } from "./platforms/xcom/dom"
import {
  clearXcomOverlayEntryPoints,
  ensureXcomOverlayEntryPoint,
  mountXcomTranslateButton,
} from "./platforms/xcom/overlay-entry"
import { watchXcomPlayer } from "./platforms/xcom/watch-player"
import { mountSubtitlesSidebar } from "./renderer/mount-subtitles-sidebar"
import { mountSubtitlesUI } from "./renderer/mount-subtitles-ui"

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

export function initXcomSubtitles(ctx: ContentScriptContext) {
  if (!isXcomHost()) {
    return
  }

  const config = getXcomConfig()
  let adapter: ReturnType<typeof createXcomSubtitlesAdapter> | null = null
  let initialized = false
  let lastStatusId = getXcomStatusId()
  let lastVideoContainer: HTMLElement | null = null

  const syncEntryPoint = () => {
    if (adapter && ensureXcomOverlayEntryPoint()) {
      mountXcomTranslateButton(adapter)
    }
  }

  ctx.onInvalidated(watchXcomPlayer(syncEntryPoint))

  const tryInit = async () => {
    const videoContainer = getCurrentVideoContainer()
    if (!getXcomStatusId() || !videoContainer || !ensureXcomOverlayEntryPoint()) {
      return
    }

    adapter ??= createXcomSubtitlesAdapter(config)
    await mountSubtitlesUI({ adapter, config })
    mountSubtitlesSidebar(adapter)

    lastStatusId = getXcomStatusId()
    lastVideoContainer = videoContainer

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
    const statusId = getXcomStatusId()
    if (!statusId) {
      clearXcomOverlayEntryPoints()
      lastStatusId = null
      lastVideoContainer = null
      return
    }

    const videoContainer = getCurrentVideoContainer()
    if (!adapter || !initialized || !videoContainer) {
      void tryInit()
      return
    }

    if (statusId === lastStatusId && videoContainer === lastVideoContainer) {
      syncEntryPoint()
      return
    }

    lastStatusId = statusId
    lastVideoContainer = videoContainer

    void (async () => {
      if (!ensureXcomOverlayEntryPoint()) {
        return
      }

      await mountSubtitlesUI({ adapter, config })
      adapter.notifyNavigation()
    })()
  }, XCOM_STATUS_POLL_INTERVAL_MS)

  ctx.onInvalidated(() => clearInterval(intervalId))
}
