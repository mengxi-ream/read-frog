import type { SubtitlesProvidersAdapter } from "../ui/subtitles-ui-context"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { renderSubtitlesTranslateButton } from "./render-translate-button"

const SHORTS_CONTROLS_SELECTOR = "#reel-overlay-container ytd-shorts-player-controls #right-controls"

export async function mountShortsTranslateButton(adapter: SubtitlesProvidersAdapter): Promise<void> {
  const container = await waitForElement(SHORTS_CONTROLS_SELECTOR)
  if (!container)
    return

  const host = renderSubtitlesTranslateButton({ adapter, openBelow: true })
  if (host.parentElement !== container)
    container.insertBefore(host, container.firstChild)
}
