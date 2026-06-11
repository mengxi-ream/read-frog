import { browser } from "#imports"
import { MIN_SIDE_CONTENT_WIDTH } from "@/utils/constants/side"
import { sendMessage } from "@/utils/message"

export const MIN_TRANSLATION_HUB_SIDE_PANEL_WIDTH = MIN_SIDE_CONTENT_WIDTH
export const MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL = 480
const MIN_SIDE_PANEL_VIEWPORT_WIDTH = MIN_TRANSLATION_HUB_SIDE_PANEL_WIDTH + MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL

export function getTranslationHubSidePanelWidth(configuredWidth: number, viewportWidth = window.innerWidth) {
  const maxPanelWidth = Math.max(
    MIN_TRANSLATION_HUB_SIDE_PANEL_WIDTH,
    viewportWidth - MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL,
  )

  return Math.min(
    maxPanelWidth,
    Math.max(MIN_TRANSLATION_HUB_SIDE_PANEL_WIDTH, configuredWidth),
  )
}

export function shouldOpenTranslationHubInNewTab() {
  const isPortrait = window.matchMedia?.("(orientation: portrait)")?.matches
    ?? window.innerHeight > window.innerWidth
  const isNarrow = window.innerWidth < MIN_SIDE_PANEL_VIEWPORT_WIDTH
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false

  return isPortrait || isNarrow || (isCoarsePointer && window.innerWidth < 1024)
}

export async function openTranslationHubInNewTab() {
  await sendMessage("openPage", {
    url: browser.runtime.getURL("/translation-hub.html"),
    active: true,
  })
}

export function openTranslationHubSidePanel({
  setHasLoadedTranslationHub,
  setIsSideOpen,
}: {
  setHasLoadedTranslationHub: (loaded: boolean) => void
  setIsSideOpen: (open: boolean) => void
}) {
  if (shouldOpenTranslationHubInNewTab()) {
    void openTranslationHubInNewTab()
    return
  }

  setHasLoadedTranslationHub(true)
  setIsSideOpen(true)
}
