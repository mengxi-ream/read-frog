import type { SubtitlesProvidersAdapter } from "../../universal-adapter"
import {
  NETFLIX_CONTROLS_GROUP_SELECTOR,
  NETFLIX_TRANSLATE_BUTTON_ZOOM,
} from "@/utils/constants/subtitles"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { renderSubtitlesTranslateButton } from "../../renderer/render-translate-button"

let mountedButton: HTMLElement | null = null

export function mountNetflixTranslateButton(adapter: SubtitlesProvidersAdapter): void {
  const group = document.querySelector(NETFLIX_CONTROLS_GROUP_SELECTOR)
  if (!group || mountedButton?.parentElement === group) {
    return
  }

  removeNetflixTranslateButton()
  mountedButton = renderSubtitlesTranslateButton({ adapter, zoom: NETFLIX_TRANSLATE_BUTTON_ZOOM })
  group.insertBefore(mountedButton, group.firstChild)
}

export function removeNetflixTranslateButton(): void {
  if (mountedButton) {
    removeReactShadowHost(mountedButton)
    mountedButton = null
  }
}

export function watchNetflixControls(onChanged: () => void): () => void {
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      onChanged()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
