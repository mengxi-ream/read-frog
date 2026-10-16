import { useLayoutEffect, useState } from "react"
import themeCSS from "@/assets/styles/theme.css?inline"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"

const TOP_LAYER_CONTAINER_CLASS =
  "pointer-events-none fixed inset-0 m-0 size-full max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 text-inherit"

function createTopLayerHost() {
  const host = document.createElement("div")
  host.classList.add(REACT_SHADOW_HOST_CLASS)
  const hostBuilder = new ShadowHostBuilder(host.attachShadow({ mode: "open" }), {
    position: "block",
    cssContent: [themeCSS],
    inheritStyles: false,
  })
  const container = document.createElement("div")
  container.setAttribute("popover", "manual")
  container.className = TOP_LAYER_CONTAINER_CLASS
  hostBuilder.build().append(container)
  return { host, hostBuilder, container }
}

export function useTopLayerPortalContainer(active: boolean) {
  const [{ host, hostBuilder, container }] = useState(createTopLayerHost)

  useLayoutEffect(() => {
    document.body.append(host)
    return () => {
      host.remove()
      hostBuilder.cleanup()
    }
  }, [host, hostBuilder])

  useLayoutEffect(() => {
    if (!active || !container.isConnected) {
      return undefined
    }

    const hide = () => {
      if (container.matches(":popover-open")) {
        container.hidePopover()
      }
    }
    const showOnTop = () => {
      hide()
      container.showPopover()
    }

    showOnTop()
    document.addEventListener("fullscreenchange", showOnTop)
    return () => {
      document.removeEventListener("fullscreenchange", showOnTop)
      hide()
    }
  }, [active, container])

  return container
}
