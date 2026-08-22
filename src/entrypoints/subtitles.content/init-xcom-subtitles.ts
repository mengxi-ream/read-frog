import type { ContentScriptContext } from "#imports"
import { XCOM_STATUS_POLL_INTERVAL_MS } from "@/utils/constants/subtitles"
import {
  getCurrentPrimaryXcomStatusVideo,
  getXcomStatusVideoContainer,
} from "@/utils/subtitles/fetchers/xcom/dom"
import { getXcomStatusId } from "@/utils/subtitles/video-id"
import { createXcomSubtitlesAdapter } from "./platforms/xcom"
import { getXcomConfig } from "./platforms/xcom/config"
import {
  clearXcomOverlayEntryPoints,
  ensureXcomOverlayEntryPoint,
} from "./platforms/xcom/overlay-entry"
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

  const tryInit = async () => {
    if (!getXcomStatusId() || !getCurrentVideoContainer() || !ensureXcomOverlayEntryPoint()) {
      return
    }

    adapter ??= createXcomSubtitlesAdapter(config)
    await mountSubtitlesUI({ adapter, config })

    lastStatusId = getXcomStatusId()
    lastVideoContainer = getCurrentVideoContainer()

    if (initialized) {
      return
    }

    initialized = true
    void adapter.initialize()
  }

  const handleRouteExit = () => {
    clearXcomOverlayEntryPoints()
    lastStatusId = null
    lastVideoContainer = null
  }

  void tryInit()

  const intervalId = setInterval(() => {
    const statusId = getXcomStatusId()
    if (!statusId) {
      handleRouteExit()
      return
    }

    if (!adapter || !initialized) {
      void tryInit()
      return
    }

    const videoContainer = getCurrentVideoContainer()
    if (!videoContainer) {
      void tryInit()
      return
    }

    if (statusId === lastStatusId && videoContainer === lastVideoContainer) {
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
