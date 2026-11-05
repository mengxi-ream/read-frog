import ReactDOM from "react-dom/client"
import themeCSS from "@/assets/styles/theme.css?inline"
import { ToastProvider } from "@/components/ui/base-ui/toast"
import { NOTRANSLATE_CLASS, REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { SUBTITLES_THEME } from "@/utils/constants/subtitles"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { applyTheme } from "@/utils/theme"

const SUBTITLES_TOAST_HOST_ID = "read-frog-subtitles-toast-host"

let mountedCleanup: (() => void) | null = null

export function mountSubtitlesToast(): () => void {
  if (mountedCleanup) return mountedCleanup

  // Left by a dead instance of this script; this instance's toasts would never reach it.
  const staleHost = document.getElementById(SUBTITLES_TOAST_HOST_ID)
  if (staleHost) {
    ;(staleHost as any).__cleanup?.()
    staleHost.remove()
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

  // The toasts portal into reactContainer, under the theme class above: in the
  // shadow root itself they would sit beside it and stay light.
  const reactRoot = ReactDOM.createRoot(reactContainer)
  reactRoot.render(
    <div className={NOTRANSLATE_CLASS}>
      <ToastProvider portalProps={{ container: reactContainer }} />
    </div>,
  )

  target.appendChild(shadowHost)

  const cleanup = () => {
    if (mountedCleanup === cleanup) mountedCleanup = null
    reactRoot.unmount()
    hostBuilder.cleanup()
    shadowHost.remove()
  }
  ;(shadowHost as any).__cleanup = cleanup
  mountedCleanup = cleanup
  return cleanup
}
