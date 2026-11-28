import { useLayoutEffect, useState } from "react"
import themeCSS from "@/assets/styles/theme.css?inline"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { isolatePlayerEvents } from "../renderer/isolate-player-events"

const TOP_LAYER_CONTAINER_CLASS =
  "pointer-events-none fixed inset-0 m-0 size-full max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 text-inherit"

function createTopLayerHost() {
  const host = document.createElement("div")
  host.classList.add(REACT_SHADOW_HOST_CLASS)
  // Out of the layout of whatever holds it, such as a player in fullscreen; the
  // card itself shows in the top layer, wherever the host is.
  host.style.position = "fixed"
  // Inside a fullscreen player, the player's handlers would take the card's
  // clicks. Anywhere else the page has to see them: the selection toolbar knows
  // a selection was made in the card, not on the page, from its mousedown.
  isolatePlayerEvents(host, () => host.parentElement !== document.body)
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
    return () => {
      host.remove()
      hostBuilder.cleanup()
    }
  }, [host, hostBuilder])

  useLayoutEffect(() => {
    const hide = () => {
      if (container.matches(":popover-open")) {
        container.hidePopover()
      }
    }
    // Chrome lets nothing outside the fullscreen element take a click, not even
    // the top layer, so the host follows that element in and out. Only what
    // was shown after the element went fullscreen sits above it, so the card
    // shows again each time.
    const place = () => {
      const fullscreenElement = document.fullscreenElement
      // A page that is fullscreen as a whole (YouTube makes <html> fullscreen)
      // already holds body, so the host stays there, as outside fullscreen.
      const parent =
        fullscreenElement && !fullscreenElement.contains(document.body)
          ? fullscreenElement
          : document.body
      if (host.parentElement !== parent) {
        // Moving the host also hides the card.
        parent.append(host)
      }
      if (active) {
        hide()
        container.showPopover()
      }
    }

    place()
    document.addEventListener("fullscreenchange", place)
    return () => {
      document.removeEventListener("fullscreenchange", place)
      hide()
    }
  }, [active, container, host])

  return container
}
