import { getCurrentPrimaryXcomStatusVideo, getCurrentXcomSubtitlesVideo, getXcomStatusVideoContainer } from "@/utils/subtitles/fetchers/xcom/dom"
import { getXcomStatusId } from "@/utils/subtitles/video-id"
import { createXcomSubtitlesAdapter } from "./platforms/xcom"
import { getXcomConfig } from "./platforms/xcom/config"
import { clearXcomOverlayEntryPoints, ensureXcomOverlayEntryPoint } from "./platforms/xcom/overlay-entry"
import { mountSubtitlesUI, unmountSubtitlesUI } from "./renderer/mount-subtitles-ui"

const XCOM_STATUS_POLL_INTERVAL_MS = 500

function isXcomRuntimeHost(): boolean {
  const { hostname } = window.location
  return hostname === "x.com"
    || hostname.endsWith(".x.com")
    || hostname === "twitter.com"
    || hostname.endsWith(".twitter.com")
}

export function initXcomSubtitles() {
  if (!isXcomRuntimeHost()) {
    return
  }

  const config = getXcomConfig()
  let adapter: ReturnType<typeof createXcomSubtitlesAdapter> | null = null
  let initialized = false
  let lastStatusId = getXcomStatusId()
  let lastShowingTextTrackKey: string | null = null
  let lastVideoContainer: HTMLElement | null = null

  const getCurrentVideoContainer = (): HTMLElement | null => {
    const video = getCurrentPrimaryXcomStatusVideo()
    return video ? getXcomStatusVideoContainer(video) : null
  }

  const getShowingTextTrackKey = (): string | null => {
    const video = getCurrentXcomSubtitlesVideo()
    const track = video
      ? Array.from(video.textTracks ?? []).find(track => track.mode === "showing")
      : null

    return track
      ? JSON.stringify([track.language, track.label])
      : null
  }

  const handleTextTrackChange = () => {
    const currentShowingTextTrackKey = getShowingTextTrackKey()
    if (currentShowingTextTrackKey && currentShowingTextTrackKey !== lastShowingTextTrackKey) {
      void adapter?.handleSourceTrackChanged()
    }
    lastShowingTextTrackKey = currentShowingTextTrackKey
  }

  const cleanupRouteExit = () => {
    if (!adapter && !initialized && !lastStatusId && !lastVideoContainer) {
      return
    }

    adapter?.cleanupForRouteExit()
    clearXcomOverlayEntryPoints()
    unmountSubtitlesUI()
    adapter = null
    initialized = false
    lastStatusId = null
    lastShowingTextTrackKey = null
    lastVideoContainer = null
  }

  const tryInit = async () => {
    const statusId = getXcomStatusId()
    if (!statusId) {
      return false
    }

    const videoContainer = getCurrentVideoContainer()
    if (!videoContainer) {
      return false
    }

    if (!ensureXcomOverlayEntryPoint()) {
      return false
    }

    if (!adapter) {
      adapter = createXcomSubtitlesAdapter(config)
    }

    await mountSubtitlesUI({ adapter, config })
    lastStatusId = statusId
    lastShowingTextTrackKey = getShowingTextTrackKey()
    lastVideoContainer = videoContainer

    if (initialized) {
      return true
    }

    initialized = true
    void adapter.initialize()
    return true
  }

  void tryInit()

  setInterval(() => {
    const currentStatusId = getXcomStatusId()

    if (!currentStatusId) {
      cleanupRouteExit()
      return
    }

    if (!adapter || !initialized) {
      void tryInit()
      return
    }

    const currentVideoContainer = getCurrentVideoContainer()
    if (!currentVideoContainer) {
      if (currentStatusId !== lastStatusId) {
        cleanupRouteExit()
        lastStatusId = currentStatusId
      }
      else {
        handleTextTrackChange()
      }
      void tryInit()
      return
    }

    const statusChanged = currentStatusId !== lastStatusId
    const videoContainerChanged = currentVideoContainer !== lastVideoContainer

    if (!statusChanged && !videoContainerChanged) {
      handleTextTrackChange()
      void tryInit()
      return
    }

    lastStatusId = currentStatusId
    lastShowingTextTrackKey = getShowingTextTrackKey()
    lastVideoContainer = currentVideoContainer

    void (async () => {
      if (!ensureXcomOverlayEntryPoint()) {
        return
      }
      await mountSubtitlesUI({ adapter, config })
      adapter.notifyNavigation({ force: true })
    })()
  }, XCOM_STATUS_POLL_INTERVAL_MS)
}
