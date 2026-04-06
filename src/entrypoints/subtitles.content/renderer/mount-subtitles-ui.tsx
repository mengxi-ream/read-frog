import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { Provider as JotaiProvider } from "jotai"
import ReactDOM from "react-dom/client"
import { Toaster } from "sonner"
import themeCSS from "@/assets/styles/theme.css?inline"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { subtitlesStore } from "../atoms"
import { SubtitlesContainer } from "../ui/subtitles-container"
import { SubtitlesUIContext } from "../ui/subtitles-ui-context"

interface MountSubtitlesUIOptions {
  config: PlatformConfig
  onToggleSubtitles: (enabled: boolean) => void
}

export async function mountSubtitlesUI(
  { config, onToggleSubtitles }: MountSubtitlesUIOptions,
): Promise<void> {
  const videoContainer = await waitForElement(config.selectors.playerContainer)
  if (!videoContainer)
    return

  const parentEl = videoContainer as HTMLElement
  const computedStyle = window.getComputedStyle(parentEl)
  if (computedStyle.position === "static") {
    parentEl.style.position = "relative"
  }

  const shadowHost = document.createElement("div")
  shadowHost.classList.add(REACT_SHADOW_HOST_CLASS)
  shadowHost.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 9999;
    transition: bottom 0.2s ease-out;
    overflow: visible;
  `

  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  const hostBuilder = new ShadowHostBuilder(shadowRoot, {
    position: "block",
    cssContent: [themeCSS],
    inheritStyles: false,
    style: {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      pointerEvents: "none",
      overflow: "visible",
    },
  })
  const reactContainer = hostBuilder.build()

  const reactRoot = ReactDOM.createRoot(reactContainer)

  ;(shadowHost as any).__reactShadowContainerCleanup = () => {
    reactRoot?.unmount()
    hostBuilder.cleanup()
  }

  parentEl.appendChild(shadowHost)

  const app = (
    <JotaiProvider store={subtitlesStore}>
      <ShadowWrapperContext value={reactContainer}>
        <ThemeProvider container={reactContainer}>
          <SubtitlesUIContext
            value={{
              toggleSubtitles: onToggleSubtitles,
              controlsConfig: config.controls,
            }}
          >
            <SubtitlesContainer />
            <Toaster richColors className="z-2147483647 notranslate" />
          </SubtitlesUIContext>
        </ThemeProvider>
      </ShadowWrapperContext>
    </JotaiProvider>
  )

  reactRoot.render(app)
}
