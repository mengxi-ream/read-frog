import type { SubtitlesProvidersAdapter } from "../ui/subtitles-ui-context"
import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import ReactDOM from "react-dom/client"
import { Toaster } from "sonner"
import themeCSS from "@/assets/styles/theme.css?inline"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { waitForElement } from "@/utils/dom/wait-for-element"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { SubtitlesContainer } from "../ui/subtitles-container"
import { SubtitlesProviders } from "../ui/subtitles-ui-context"

const SUBTITLES_UI_HOST_ID = "read-frog-subtitles-ui-host"

interface MountSubtitlesUIOptions {
  adapter: SubtitlesProvidersAdapter
  config: Pick<PlatformConfig, "selectors">
}

export async function mountSubtitlesUI(
  { adapter, config }: MountSubtitlesUIOptions,
): Promise<void> {
  const videoContainer = await waitForElement(config.selectors.playerContainer)
  if (!videoContainer)
    return

  const parentEl = videoContainer as HTMLElement
  const computedStyle = window.getComputedStyle(parentEl)
  if (computedStyle.position === "static") {
    parentEl.style.position = "relative"
  }

  const existingHost = document.getElementById(SUBTITLES_UI_HOST_ID) as HTMLDivElement | null
  if (existingHost) {
    if (existingHost.parentElement === parentEl) {
      return
    }

    ;(existingHost as any).__reactShadowContainerCleanup?.()
    existingHost.remove()
  }

  const shadowHost = document.createElement("div")
  shadowHost.id = SUBTITLES_UI_HOST_ID
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
    <ShadowWrapperContext value={reactContainer}>
      <ThemeProvider container={reactContainer}>
        <SubtitlesProviders adapter={adapter}>
          <SubtitlesContainer />
          <Toaster richColors className="z-2147483647 notranslate" />
        </SubtitlesProviders>
      </ThemeProvider>
    </ShadowWrapperContext>
  )

  reactRoot.render(app)
}
