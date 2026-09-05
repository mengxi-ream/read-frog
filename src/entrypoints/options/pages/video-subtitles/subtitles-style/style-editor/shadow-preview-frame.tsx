import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import themeCSS from "@/assets/styles/theme.css?inline"
import { SUBTITLES_THEME } from "@/utils/constants/subtitles"
import { ensureSubtitlesCustomCSS } from "@/utils/host/translate/ui/style-injector"
import { ShadowHostBuilder } from "@/utils/react-shadow-host/shadow-host-builder"
import { cn } from "@/utils/styles/utils"
import { applyTheme } from "@/utils/theme"

interface ShadowPreviewFrameProps {
  /** The user's CSS, verbatim. Nothing rewrites it — the shadow boundary is what contains it. */
  customCSS?: string
  children: ReactNode
  className?: string
}

/**
 * Renders the subtitle preview inside a shadow root, the way the real overlay runs.
 *
 * The preview shows CSS the user is still typing, so a rule broad enough to match the settings page
 * around it — `* { filter: blur(10px) }`, or a stray `}` followed by `body { display: none }` — must
 * not be able to reach it. Rewriting every selector to sit under a scope class was the obvious way
 * to arrange that, and it leaked in three directions at once: at-rules with no selector (`@font-face`,
 * `@property`) passed through untouched, `@keyframes` names stayed global and could hijack the
 * settings page's own animations, and every rewritten selector gained a class's worth of specificity
 * that production never adds — so the preview could show a rule winning that loses on the video.
 *
 * A shadow root has none of those seams because the containment is the browser's, not ours. It also
 * makes the preview structurally the same thing as production: the same `ShadowHostBuilder`, the same
 * `theme.css`, the same `ensureSubtitlesCustomCSS` injection, and the user's CSS byte-for-byte.
 *
 * What a shadow root does NOT contain is layout: `position: fixed` still resolves against the
 * viewport, and `height: 100000px` still grows the page and pushes the editor below the fold. That
 * is what the containment on the light-DOM wrapper is for, and it has to live out here — a rule
 * inside could otherwise turn it off.
 */
export function ShadowPreviewFrame({ customCSS, children, className }: ShadowPreviewFrameProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const shadowRootRef = useRef<ShadowRoot | null>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    // StrictMode runs this effect twice against the same host, and `attachShadow` throws on a host
    // that already has one — reuse it and clear what the previous pass left behind.
    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    shadowRoot.replaceChildren()

    const builder = new ShadowHostBuilder(shadowRoot, {
      position: "block",
      cssContent: [themeCSS],
      inheritStyles: false,
    })
    const wrapper = builder.build()
    // The overlay pins its own theme rather than following the page it sits on; the preview has to
    // pin the same one or it shows the subtitle box against the wrong tokens.
    applyTheme(wrapper, SUBTITLES_THEME)

    shadowRootRef.current = shadowRoot
    setContainer(wrapper)

    return () => {
      builder.cleanup()
      shadowRoot.replaceChildren()
      shadowRootRef.current = null
      setContainer(null)
    }
  }, [])

  useEffect(() => {
    const shadowRoot = shadowRootRef.current
    if (!shadowRoot) return
    // Empty string rather than an early return: clearing the editor has to take the old sheet back
    // off, not leave the last one adopted.
    void ensureSubtitlesCustomCSS(shadowRoot, customCSS ?? "")
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the dependencies are re-run triggers, not values the effect body reads
  }, [customCSS, container])

  return (
    <div
      className={cn(
        // `contain: layout` makes this the containing block for any `position: fixed` inside,
        // including across the shadow boundary; `paint` plus the max height and overflow keep a
        // runaway box from growing the settings page under it. Verified in Chrome: without them a
        // 100000px-tall rule pushes the CSS editor 100k pixels down the page.
        "max-h-[420px] overflow-hidden [contain:layout_paint]",
        className,
      )}
    >
      <div ref={hostRef} />
      {container && createPortal(children, container)}
    </div>
  )
}
