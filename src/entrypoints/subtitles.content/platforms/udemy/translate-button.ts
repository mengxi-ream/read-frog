import type { SubtitlesProvidersAdapter } from "../../universal-adapter"
import {
  UDEMY_CAPTIONS_BUTTON_SELECTOR,
  UDEMY_CONTROLS_SELECTOR,
} from "@/utils/constants/subtitles"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { renderSubtitlesTranslateButton } from "../../renderer/render-translate-button"

let mountedButton: HTMLElement | null = null

/** Puts the button before the captions button, again whenever Udemy rebuilds its controls. */
export function mountUdemyTranslateButton(adapter: SubtitlesProvidersAdapter): void {
  const captionsControl = document
    .querySelector(UDEMY_CAPTIONS_BUTTON_SELECTOR)
    ?.closest(`${UDEMY_CONTROLS_SELECTOR} > *`)
  if (!captionsControl || mountedButton?.nextElementSibling === captionsControl) {
    return
  }

  removeUdemyTranslateButton()
  mountedButton = renderSubtitlesTranslateButton({ adapter })
  captionsControl.before(mountedButton)
}

export function removeUdemyTranslateButton(): void {
  if (mountedButton) {
    removeReactShadowHost(mountedButton)
    mountedButton = null
  }
}
