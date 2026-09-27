import type { ReactNode } from "react"
import { useEffect, useLayoutEffect, useState } from "react"
import { createPortal } from "react-dom"
import themeCSS from "@/assets/styles/theme.css?inline"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { cn } from "@/utils/styles/utils"
import { applyTheme } from "@/utils/theme"

interface LayoutPreviewFrameProps {
  theme: "light" | "dark"
  children: ReactNode
  className?: string
}

/**
 * The selection overlay's root, rebuilt for the options page: a shadow root with the same reset
 * and theme.css, a wrapper carrying the overlay wrapper's classes and the pinned theme. Inside it
 * the preview renders the production CustomActionLayoutView, whose own shadow root then nests
 * exactly as it does in the popup, so `--rf-*` tokens, fonts and `:host` rules resolve the same.
 *
 * Like the subtitles preview (shadow-preview-frame.tsx), the layout containment lives out here on
 * the light-DOM wrapper, where nothing a layout writes can reach it: `contain: layout paint` keeps a
 * `position: fixed` inside the frame and clips a runaway height to the scroll box.
 */
export function LayoutPreviewFrame({ theme, children, className }: LayoutPreviewFrameProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!host) return undefined

    // StrictMode runs this twice on the same host, and attachShadow throws on a second call.
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    shadowRoot.replaceChildren()

    const builder = new ShadowHostBuilder(shadowRoot, {
      position: "block",
      cssContent: [themeCSS],
      inheritStyles: false,
    })
    const wrapper = builder.build()
    // insertShadowRootUIWrapperInto's classes, minus the page-level z-index.
    wrapper.className = "text-base antialiased font-sans text-foreground"
    // oxlint-disable-next-line react/set-state-in-effect -- the portal target only exists once the shadow root is built
    setContainer(wrapper)

    return () => {
      builder.cleanup()
      shadowRoot.replaceChildren()
      setContainer(null)
    }
  }, [host])

  useLayoutEffect(() => {
    if (container) applyTheme(container, theme)
  }, [container, theme])

  return (
    <div className={cn("overflow-auto overscroll-contain [contain:layout_paint]", className)}>
      <div ref={setHost} />
      {container && createPortal(children, container)}
    </div>
  )
}
