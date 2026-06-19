import type { SubtitlesProvidersAdapter } from "../ui/subtitles-ui-context"
import ReactDOM from "react-dom/client"
import themeCSS from "@/assets/styles/theme.css?inline"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { SUBTITLES_THEME, TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { applyTheme } from "@/utils/theme"
import { SubtitlesSettingsPanel } from "../ui/subtitles-settings-panel"
import { SubtitlesTranslateButton } from "../ui/subtitles-translate-button"
import { SubtitlesProviders } from "../ui/subtitles-ui-context"

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
  .${SUBTITLES_THEME} {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
  }
`

const embedWrapperCSS = `
  :host {
    display: inline-flex;
    align-items: center;
    position: relative;
    height: 100%;
  }
  .${SUBTITLES_THEME} {
    display: flex;
    align-items: center;
    height: 100%;
    position: relative;
  }
`

export function renderSubtitlesTranslateButton(adapter: SubtitlesProvidersAdapter): HTMLDivElement {
  const existingContainer = document.querySelector<HTMLDivElement>(`#${TRANSLATE_BUTTON_CONTAINER_ID}`)
  if (existingContainer)
    return existingContainer

  const component = adapter.embedded
    ? (
        <SubtitlesProviders adapter={adapter}>
          <SubtitlesTranslateButton />
          <SubtitlesSettingsPanel />
        </SubtitlesProviders>
      )
    : <SubtitlesTranslateButton />

  const shadowHost = document.createElement("div")
  shadowHost.id = TRANSLATE_BUTTON_CONTAINER_ID
  shadowHost.classList.add(REACT_SHADOW_HOST_CLASS)
  shadowHost.style.display = "inline"

  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  const hostBuilder = new ShadowHostBuilder(shadowRoot, {
    position: "inline",
    inheritStyles: false,
    cssContent: [themeCSS, adapter.embedded ? embedWrapperCSS : wrapperCSS],
    ...(adapter.embedded && { style: { position: "relative" } }),
  })
  const reactContainer = hostBuilder.build()
  applyTheme(reactContainer, SUBTITLES_THEME)

  const root = ReactDOM.createRoot(reactContainer)
  root.render(
    <ShadowWrapperContext value={reactContainer}>
      {component}
    </ShadowWrapperContext>,
  )

  ;(shadowHost as any).__reactShadowContainerCleanup = () => {
    root.unmount()
    hostBuilder.cleanup()
  }

  if (adapter.embedded) {
    for (const eventType of ["click", "mousedown", "pointerdown", "dblclick"]) {
      shadowHost.addEventListener(eventType, e => e.stopPropagation())
    }
  }

  return shadowHost
}
