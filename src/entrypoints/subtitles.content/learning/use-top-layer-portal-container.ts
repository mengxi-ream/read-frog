import { use, useLayoutEffect, useState } from "react"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"

const TOP_LAYER_CONTAINER_CLASS =
  "pointer-events-none fixed inset-0 m-0 size-full max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 text-inherit"

export function useTopLayerPortalContainer(active: boolean) {
  const shadowWrapper = use(ShadowWrapperContext)
  const [container] = useState(() => {
    const element = document.createElement("div")
    element.setAttribute("popover", "manual")
    element.className = TOP_LAYER_CONTAINER_CLASS
    return element
  })

  useLayoutEffect(() => {
    const shadowRoot = shadowWrapper?.getRootNode()
    if (!(shadowRoot instanceof ShadowRoot)) {
      return undefined
    }
    shadowRoot.appendChild(container)
    return () => container.remove()
  }, [container, shadowWrapper])

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
