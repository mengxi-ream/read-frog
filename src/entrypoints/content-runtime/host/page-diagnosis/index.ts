import * as React from "react"
import textSmallCSS from "@/assets/styles/text-small.css?inline"
import themeCSS from "@/assets/styles/theme.css?inline"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import {
  createReactShadowHost,
  removeReactShadowHost,
} from "@/utils/react-shadow-host/create-shadow-host"
import { PageDiagnosisPanel } from "./panel"

let panelHost: HTMLElement | null = null

export function closePageDiagnosisPanel(): void {
  if (!panelHost) return
  removeReactShadowHost(panelHost)
  panelHost = null
}

/** Opened from the popup's "Diagnose this page"; a second request closes it. */
export function togglePageDiagnosisPanel(): void {
  if (panelHost) {
    closePageDiagnosisPanel()
    return
  }
  panelHost = createReactShadowHost(
    React.createElement(PageDiagnosisPanel, { onClose: closePageDiagnosisPanel }),
    {
      // Kept out of page translation, which would otherwise translate the panel.
      className: NOTRANSLATE_CLASS,
      position: "block",
      inheritStyles: false,
      cssContent: [themeCSS, textSmallCSS],
    },
  )
  document.body.append(panelHost)
}
