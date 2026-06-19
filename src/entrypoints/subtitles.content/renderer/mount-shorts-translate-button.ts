import type { SubtitlesProvidersAdapter } from "../ui/subtitles-ui-context"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { renderSubtitlesTranslateButton } from "./render-translate-button"

const SHORTS_CONTROLS_SELECTOR = "#reel-overlay-container ytd-shorts-player-controls #right-controls"

export async function mountShortsTranslateButton(adapter: SubtitlesProvidersAdapter): Promise<void> {
  const existing = document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)
  if (existing)
    removeReactShadowHost(existing)

  const container = await waitForElement(SHORTS_CONTROLS_SELECTOR)
  if (!container)
    return

  const host = renderSubtitlesTranslateButton({ adapter, openBelow: true })
  container.insertBefore(host, container.firstChild)
}
