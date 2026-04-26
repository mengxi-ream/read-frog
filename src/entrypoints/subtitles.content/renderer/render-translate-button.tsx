import type { SubtitlesProvidersAdapter } from "../ui/subtitles-ui-context"
import themeCSS from "@/assets/styles/theme.css?inline"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { createReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
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
  .light, .dark {
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
  .light, .dark {
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

  const shadowHost = createReactShadowHost(component, {
    position: "inline",
    inheritStyles: false,
    cssContent: [themeCSS, adapter.embedded ? embedWrapperCSS : wrapperCSS],
    ...(adapter.embedded && { style: { position: "relative" }, forcedTheme: "dark" as const }),
  }) as HTMLDivElement

  shadowHost.id = TRANSLATE_BUTTON_CONTAINER_ID

  if (adapter.embedded) {
    for (const eventType of ["click", "mousedown", "pointerdown", "dblclick"]) {
      shadowHost.addEventListener(eventType, e => e.stopPropagation())
    }
  }

  return shadowHost
}
