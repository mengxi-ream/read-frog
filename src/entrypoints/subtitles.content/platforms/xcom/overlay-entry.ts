import type { SubtitlesProvidersAdapter } from "../../universal-adapter"
import {
  TRANSLATE_BUTTON_CONTAINER_ID,
  XCOM_CONTROLS_CONTAINER_ATTRIBUTE,
  XCOM_CONTROLS_CONTAINER_SELECTOR,
  XCOM_PLAYER_CONTAINER_ATTRIBUTE,
  XCOM_PLAYER_CONTAINER_SELECTOR,
} from "@/utils/constants/subtitles"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { renderSubtitlesTranslateButton } from "../../renderer/render-translate-button"
import {
  findXcomControlsGroup,
  getCurrentPrimaryXcomStatusVideo,
  getXcomStatusVideoContainer,
} from "./dom"

// x.com has no stable selectors, so we stamp our own for getXcomConfig to target.
function clearStamps(except?: {
  container?: HTMLElement | null
  controls?: HTMLElement | null
}): void {
  for (const container of document.querySelectorAll<HTMLElement>(XCOM_PLAYER_CONTAINER_SELECTOR)) {
    if (container !== except?.container) {
      container.removeAttribute(XCOM_PLAYER_CONTAINER_ATTRIBUTE)
    }
  }

  for (const controls of document.querySelectorAll<HTMLElement>(XCOM_CONTROLS_CONTAINER_SELECTOR)) {
    if (controls !== except?.controls) {
      controls.removeAttribute(XCOM_CONTROLS_CONTAINER_ATTRIBUTE)
    }
  }
}

// Tracked by reference: x.com discards the controls group with our host inside,
// and a detached host is unreachable from the document.
let mountedButton: HTMLElement | null = null

function removeTranslateButton(): void {
  const host = mountedButton ?? document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)
  mountedButton = null
  if (host) {
    removeReactShadowHost(host)
  }
}

export function clearXcomOverlayEntryPoints(): void {
  clearStamps()
  removeTranslateButton()
}

export function ensureXcomOverlayEntryPoint(): boolean {
  const video = getCurrentPrimaryXcomStatusVideo()
  const videoContainer = video ? getXcomStatusVideoContainer(video) : null
  if (!videoContainer) {
    return false
  }

  const controls = findXcomControlsGroup(videoContainer)
  clearStamps({ container: videoContainer, controls })
  videoContainer.setAttribute(XCOM_PLAYER_CONTAINER_ATTRIBUTE, "true")

  // The previous video's group survives on a timeline, so drop the orphaned button.
  if (!controls) {
    removeTranslateButton()
    return true
  }

  controls.setAttribute(XCOM_CONTROLS_CONTAINER_ATTRIBUTE, "true")

  return true
}

export function mountXcomTranslateButton(adapter: SubtitlesProvidersAdapter): void {
  const controls = document.querySelector(XCOM_CONTROLS_CONTAINER_SELECTOR)
  if (!controls || controls.querySelector(`#${TRANSLATE_BUTTON_CONTAINER_ID}`)) {
    return
  }

  removeTranslateButton()
  mountedButton = renderSubtitlesTranslateButton({ adapter })
  controls.appendChild(mountedButton)
}
