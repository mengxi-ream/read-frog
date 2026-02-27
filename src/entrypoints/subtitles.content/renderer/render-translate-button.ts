import * as React from "react"
import themeCSS from "@/assets/styles/theme.css?inline"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { createReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { SubtitleToggleButton } from "../ui/subtitles-translate-button"

const wrapperCSS = `
  :host {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    height: 100%;
    margin: 0;
    padding: 0;
  }
  .light, .dark {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
  }
`

export function renderSubtitlesTranslateButton(
  onToggle: (enabled: boolean) => void,
): HTMLDivElement {
  const existingContainer = document.querySelector<HTMLDivElement>(`#${TRANSLATE_BUTTON_CONTAINER_ID}`)

  if (existingContainer) {
    return existingContainer
  }

  const component = React.createElement(SubtitleToggleButton, {
    onToggle,
  })

  const shadowHost = createReactShadowHost(component, {
    position: "inline",
    inheritStyles: false,
    cssContent: [themeCSS, wrapperCSS],
  }) as HTMLDivElement

  shadowHost.id = TRANSLATE_BUTTON_CONTAINER_ID

  return shadowHost
}
