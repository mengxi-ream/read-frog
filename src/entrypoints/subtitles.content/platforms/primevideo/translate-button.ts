import type { SubtitlesProvidersAdapter } from "../../adapter/subtitles-providers-adapter"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { renderSubtitlesTranslateButton } from "../../renderer/render-translate-button"
import { findTopRightRow } from "./dom"

let mountedButton: HTMLElement | null = null

/** Puts the button last in the top-right row, again each time Prime brings its controls back. */
export function mountPrimeVideoTranslateButton(adapter: SubtitlesProvidersAdapter): void {
  if (mountedButton?.isConnected) return
  const row = findTopRightRow()
  const primeButton = row?.querySelector("button")
  if (!row || !primeButton) return

  removePrimeVideoTranslateButton()
  mountedButton = renderSubtitlesTranslateButton({ adapter })
  // Prime lifts its buttons above its open menus; ours goes as high, or a menu would cover it.
  const { position, zIndex } = getComputedStyle(primeButton)
  Object.assign(mountedButton.style, { position, zIndex })
  row.append(mountedButton)
}

export function removePrimeVideoTranslateButton(): void {
  if (mountedButton) {
    removeReactShadowHost(mountedButton)
    mountedButton = null
  }
}
