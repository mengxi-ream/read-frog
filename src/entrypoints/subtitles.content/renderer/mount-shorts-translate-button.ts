import type { SubtitlesProvidersAdapter } from "../universal-adapter"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { renderSubtitlesTranslateButton } from "./render-translate-button"

const SHORTS_CONTROLS_SELECTOR =
  "#reel-overlay-container ytd-shorts-player-controls #right-controls"

export interface ShortsTranslateButtonMount {
  /** Puts the button into the active reel's controls once they exist; call again per reel. */
  mount: () => Promise<void>
  /** Removes the button and makes a mount still waiting for the controls back out. */
  dispose: () => void
}

export function createShortsTranslateButtonMount(
  adapter: SubtitlesProvidersAdapter,
): ShortsTranslateButtonMount {
  let disposed = false

  const mount = async () => {
    const container = await waitForElement(SHORTS_CONTROLS_SELECTOR)
    if (disposed || !container) return

    const host = renderSubtitlesTranslateButton({ adapter })
    if (host.parentElement !== container) container.insertBefore(host, container.firstChild)
  }

  const dispose = () => {
    disposed = true
    const host = document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)
    if (host) removeReactShadowHost(host)
  }

  return { mount, dispose }
}
