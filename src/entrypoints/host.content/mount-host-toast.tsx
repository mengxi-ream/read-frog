import ReactDOM from "react-dom/client"
import themeCSS from "@/assets/styles/theme.css?inline"
import { ToastProvider } from "@/components/ui/base-ui/toast"
import { NOTRANSLATE_CLASS, REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { LocaleBoundary } from "@/utils/i18n/locale-boundary"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"

export function mountHostToast(): () => void {
  const target = document.body ?? document.documentElement
  const shadowHost = document.createElement("div")
  shadowHost.classList.add(REACT_SHADOW_HOST_CLASS)
  shadowHost.setAttribute("data-read-frog-host-toast", "")

  const shadowRoot = shadowHost.attachShadow({ mode: "open" })
  const hostBuilder = new ShadowHostBuilder(shadowRoot, {
    position: "block",
    cssContent: [themeCSS],
    inheritStyles: false,
  })
  const reactContainer = hostBuilder.build()

  const root = ReactDOM.createRoot(reactContainer)
  root.render(
    <div className={NOTRANSLATE_CLASS}>
      {/*
        This context has no page-level React tree, so LocaleBoundary lives at the toast
        root: it drives i18next.changeLanguage off the config storage watcher (via the
        default store's configAtom.onMount), keeping event-time toast strings — e.g.
        translate-text.ts's toastManager.add(...) — in the current UI language.
      */}
      <LocaleBoundary>
        <ToastProvider portalProps={{ container: shadowRoot }} />
      </LocaleBoundary>
    </div>,
  )

  target.appendChild(shadowHost)

  let cleaned = false

  return () => {
    if (cleaned) return

    cleaned = true
    root.unmount()
    hostBuilder.cleanup()
    shadowHost.remove()
  }
}
