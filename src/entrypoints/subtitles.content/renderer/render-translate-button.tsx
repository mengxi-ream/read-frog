import type { SubtitlesProvidersAdapter } from "../universal-adapter"
import themeCSS from "@/assets/styles/theme.css?inline"
import {
  SUBTITLES_THEME,
  TRANSLATE_BUTTON_CLASS,
  TRANSLATE_BUTTON_CONTAINER_ID,
} from "@/utils/constants/subtitles"
import { createReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { SubtitlesSettingsPanel } from "../ui/subtitles-settings-panel"
import { isMenuInControls } from "../ui/subtitles-settings-panel/menu-placement"
import { SubtitlesTranslateButton } from "../ui/subtitles-translate-button"
import { SubtitlesProviders } from "../ui/subtitles-ui-context"
import { isolatePlayerEvents } from "./isolate-player-events"

// The button's height in a controls row that fits it, as YouTube's does.
const TRANSLATE_BUTTON_HEIGHT = 40

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

export function renderSubtitlesTranslateButton({
  adapter,
  zoom,
  height,
}: {
  adapter: SubtitlesProvidersAdapter
  zoom?: number
  height?: number
}): HTMLDivElement {
  const existingContainer = document.querySelector<HTMLDivElement>(
    `#${TRANSLATE_BUTTON_CONTAINER_ID}`,
  )
  if (existingContainer) return existingContainer

  const component = isMenuInControls(adapter.embedded) ? (
    <SubtitlesProviders adapter={adapter}>
      <SubtitlesTranslateButton />
      <SubtitlesSettingsPanel />
    </SubtitlesProviders>
  ) : (
    <SubtitlesTranslateButton />
  )

  const shadowHost = createReactShadowHost(component, {
    position: "inline",
    inheritStyles: false,
    cssContent: [
      themeCSS,
      adapter.embedded ? embedWrapperCSS : wrapperCSS,
      ...(zoom ? [`:host { height: auto; zoom: ${zoom}; }`] : []),
      // In a shorter box the button keeps its height and overhangs evenly, centered on the row.
      ...(height
        ? [
            `:host { height: ${height}px; }`,
            `.${TRANSLATE_BUTTON_CLASS} { height: ${TRANSLATE_BUTTON_HEIGHT}px; margin-block: ${(height - TRANSLATE_BUTTON_HEIGHT) / 2}px; }`,
          ]
        : []),
    ],
    forcedTheme: SUBTITLES_THEME,
    ...(adapter.embedded && { style: { position: "relative" } }),
  })

  shadowHost.id = TRANSLATE_BUTTON_CONTAINER_ID

  if (adapter.embedded) {
    isolatePlayerEvents(shadowHost)
  }

  return shadowHost
}
