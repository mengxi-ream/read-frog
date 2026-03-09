import ReactDOM from "react-dom/client"
import themeCSS from "@/assets/styles/theme.css?inline"
import FrogToast from "@/components/frog-toast"
import { NOTRANSLATE_CLASS, REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { addStyleToShadow } from "@/utils/styles"

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

  addStyleToShadow(shadowRoot)

  const root = ReactDOM.createRoot(reactContainer)
  root.render(
    <div className={NOTRANSLATE_CLASS}>
      <FrogToast />
    </div>,
  )

  target.appendChild(shadowHost)

  let cleaned = false

  return () => {
    if (cleaned)
      return

    cleaned = true
    root.unmount()
    hostBuilder.cleanup()
    shadowHost.remove()
  }
}
