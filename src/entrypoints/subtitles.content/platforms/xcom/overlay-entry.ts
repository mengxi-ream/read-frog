import {
  DEFAULT_CONTROLS_HEIGHT,
  XCOM_CONTROLS_CONTAINER_ATTRIBUTE,
  XCOM_CONTROLS_CONTAINER_SELECTOR,
  XCOM_PLAYER_CONTAINER_ATTRIBUTE,
  XCOM_PLAYER_CONTAINER_SELECTOR,
} from "@/utils/constants/subtitles"
import { getCurrentPrimaryXcomStatusVideo, getXcomStatusVideoContainer } from "@/utils/subtitles/fetchers/xcom/dom"

const XCOM_OVERLAY_EDGE_OFFSET_PX = 12

function clearStaleEntryPoints(currentContainer: HTMLElement): void {
  document.querySelectorAll<HTMLElement>(XCOM_PLAYER_CONTAINER_SELECTOR)
    .forEach((container) => {
      if (container === currentContainer) {
        return
      }

      container.removeAttribute(XCOM_PLAYER_CONTAINER_ATTRIBUTE)
      container.querySelector(XCOM_CONTROLS_CONTAINER_SELECTOR)?.remove()
    })
}

export function clearXcomOverlayEntryPoints(): void {
  document.querySelectorAll<HTMLElement>(XCOM_CONTROLS_CONTAINER_SELECTOR)
    .forEach(container => container.remove())

  document.querySelectorAll<HTMLElement>(XCOM_PLAYER_CONTAINER_SELECTOR)
    .forEach(container => container.removeAttribute(XCOM_PLAYER_CONTAINER_ATTRIBUTE))
}

function styleOverlayEntryPoint(container: HTMLElement): void {
  Object.assign(container.style, {
    position: "absolute",
    right: `${XCOM_OVERLAY_EDGE_OFFSET_PX}px`,
    top: "auto",
    bottom: `${DEFAULT_CONTROLS_HEIGHT + XCOM_OVERLAY_EDGE_OFFSET_PX}px`,
    width: "48px",
    height: "48px",
    zIndex: "10000",
    pointerEvents: "auto",
  })
}

export function ensureXcomOverlayEntryPoint(): boolean {
  const video = getCurrentPrimaryXcomStatusVideo()
  if (!video) {
    return false
  }

  const videoContainer = getXcomStatusVideoContainer(video)
  if (!videoContainer) {
    return false
  }

  clearStaleEntryPoints(videoContainer)
  videoContainer.setAttribute(XCOM_PLAYER_CONTAINER_ATTRIBUTE, "true")

  const existingEntryPoint = videoContainer.querySelector<HTMLElement>(XCOM_CONTROLS_CONTAINER_SELECTOR)
  if (existingEntryPoint) {
    styleOverlayEntryPoint(existingEntryPoint)
    return true
  }

  const entryPoint = document.createElement("div")
  entryPoint.setAttribute(XCOM_CONTROLS_CONTAINER_ATTRIBUTE, "true")
  entryPoint.setAttribute("aria-label", "Read Frog subtitle translation")
  styleOverlayEntryPoint(entryPoint)

  videoContainer.appendChild(entryPoint)
  return true
}
