import ReactDOM from "react-dom/client"
import { Toaster } from "sonner"
import themeCSS from "@/assets/styles/theme.css?inline"
import { NOTRANSLATE_CLASS, REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { SUBTITLES_THEME } from "@/utils/constants/subtitles"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { mirrorDynamicStyles } from "@/utils/styles"
import { applyTheme } from "@/utils/theme"

const SUBTITLES_TOAST_HOST_ID = "read-frog-subtitles-toast-host"

export function mountSubtitlesToast(): () => void {
  const existingHost = document.getElementById(SUBTITLES_TOAST_HOST_ID)
  if (existingHost) {
    return (existingHost as any).__cleanup ?? (() => {})
  }

  const target = document.body ?? document.documentElement
  const shadowHost = document.createElement("div")
  shadowHost.id = SUBTITLES_TOAST_HOST_ID
  shadowHost.classList.add(REACT_SHADOW_HOST_CLASS)

  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  const hostBuilder = new ShadowHostBuilder(shadowRoot, {
    position: "block",
    cssContent: [themeCSS],
    inheritStyles: false,
  })
  const reactContainer = hostBuilder.build()
  applyTheme(reactContainer, SUBTITLES_THEME)
  const cleanupMirroredStyles = mirrorDynamicStyles("style", shadowRoot, "[data-sonner-toaster]")

  const reactRoot = ReactDOM.createRoot(reactContainer)
  reactRoot.render(
    <div className={NOTRANSLATE_CLASS}>
      <Toaster richColors />
    </div>,
  )

  target.appendChild(shadowHost)

  const cleanup = () => {
    cleanupMirroredStyles()
    reactRoot.unmount()
    hostBuilder.cleanup()
    shadowHost.remove()
  }
  ;(shadowHost as any).__cleanup = cleanup
  return cleanup
}
