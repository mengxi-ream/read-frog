import type { ReactNode } from "react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/utils/styles/utils"

/** The srcdoc's own URL once the frame has navigated to it. `about:blank` is the document that
 *  exists first, and it is a different one — see the mount effect. */
const SRCDOC_URL = "about:srcdoc"

const SHELL = "<!doctype html><html><head></head><body></body></html>"

/** Tall enough for the one or two lines this normally holds, once padding is counted. */
const MIN_HEIGHT = 64
/**
 * The ceiling is the containment. A frame sized purely to its content would hand back the one thing
 * the iframe buys for free — `height: 100000px` inside would grow the frame, and the frame would
 * grow the settings page, which is exactly the lockout this replaced.
 */
const MAX_HEIGHT = 320

/**
 * Typography is deliberately plain — custom CSS is written against ordinary web pages, so the frame
 * should read as the least surprising one rather than as this settings page. The previous preview
 * inherited the options page's Inter and its 14px `text-sm`, neither of which a translated node
 * ever sees in the wild.
 *
 * Colour is the opposite: it follows the extension's own theme, because a white card in a dark
 * settings page reads as a rendering fault. The values come from the same `--rf-*` tokens the page
 * around it uses, so the two always agree.
 *
 * `color-scheme` follows the theme with them, which decides what `light-dark()` resolves to — and
 * the CSS shipped as the starting example in every locale leads with `light-dark()`. Following the
 * theme means the preview shows the branch matching the mode being looked at, and switching the
 * extension's theme is how to see the other one. Pinning it light instead would make the dark
 * branch unpreviewable, which is worse than either being "the" answer.
 */
/**
 * The theme as it is actually painted, read off the element `applyTheme` writes it to.
 *
 * Read from the DOM rather than from the theme context, because this is the same element the tokens
 * below are read from — one source of truth, and it cannot disagree with what is on screen. It also
 * keeps the preview renderable without a theme provider above it, which the sections that embed it
 * do not otherwise need.
 */
function useAppliedTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
      return () => observer.disconnect()
    },
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
  )
}

function buildFrameCSS(theme: "light" | "dark"): string {
  const root = getComputedStyle(document.documentElement)
  const background = root.getPropertyValue("--rf-background").trim() || "#fff"
  const foreground = root.getPropertyValue("--rf-foreground").trim() || "#1a1a1a"

  return `
    html { background: ${background}; color: ${foreground}; color-scheme: ${theme}; }
    body { margin: 0; padding: 16px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
           font-size: 16px; line-height: 1.6; }
  `
}

interface PagePreviewFrameProps {
  children: ReactNode
  className?: string
}

/**
 * Renders the translated-node preview inside a same-origin `srcdoc` iframe.
 *
 * The CSS shown here is the user's, and production injects it into the host page's *document* —
 * so until now this preview injected it into the settings page's document, where a rule as ordinary
 * as `* { display: none }` left the options UI blank on every load, editor and sidebar included,
 * with the offending CSS saved in config and no way back through the UI.
 *
 * An iframe is the only container that is also a Document, which is why it is used here rather than
 * the shadow root the subtitle preview uses: a shadow tree has no `:root` and no `body`, ignores
 * `@property` and `@font-face`, and answers to `:host`, so it would quietly disagree with production
 * on every one of those — in both directions. The frame agrees with production and contains
 * everything, layout included: a fixed-height frame is its own viewport, so `position: fixed` and a
 * runaway height stay inside it with no containment tricks.
 *
 * The frame follows its content only between a floor and a ceiling — an unbounded content size
 * would give that last property back.
 */
export function PagePreviewFrame({ children, className }: PagePreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState(MIN_HEIGHT)
  const theme = useAppliedTheme()

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined

    // The frame starts on an `about:blank` document that already reports `readyState: "complete"`,
    // and is then replaced by a different document for the srcdoc. Keying off readiness portals the
    // children into the throwaway one and the preview comes up permanently empty; the URL is what
    // actually distinguishes them.
    const attach = () => {
      const doc = frame.contentDocument
      if (!doc || doc.URL !== SRCDOC_URL) return false
      setBody(doc.body)
      return true
    }

    if (attach()) return undefined

    frame.addEventListener("load", attach)
    return () => {
      frame.removeEventListener("load", attach)
      setBody(null)
    }
  }, [])

  // Rewritten rather than written once: the theme can change while the page is open, and the frame
  // has to follow it. Injected ahead of anything the user writes, so their CSS still wins.
  useEffect(() => {
    if (!body) return

    const doc = body.ownerDocument
    let style = doc.getElementById("read-frog-preview-base")
    if (!style) {
      style = doc.createElement("style")
      style.id = "read-frog-preview-base"
      doc.head.prepend(style)
    }
    style.textContent = buildFrameCSS(theme)
  }, [body, theme])

  // Follow the content between the two bounds, so a single line does not sit in a tall empty box.
  // `body` is measured rather than `documentElement`, whose scrollHeight is floored at the frame's
  // own viewport and would therefore never let the frame shrink again — and its rect rather than
  // its `scrollHeight`, which is a rounded integer: a body 73.59px tall reports 73, one pixel short
  // of its own content, and the frame comes up with a scrollbar it does not need.
  useEffect(() => {
    if (!body) return undefined

    const measure = () => {
      const content = Math.ceil(body.getBoundingClientRect().height)
      setHeight(Math.min(Math.max(content, MIN_HEIGHT), MAX_HEIGHT))
    }
    measure()

    const view = body.ownerDocument.defaultView
    if (!view?.ResizeObserver) return undefined

    const observer = new view.ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [body])

  return (
    // The border lives out here rather than on the frame. `box-sizing: border-box` would otherwise
    // take it out of the height set below, leaving the frame's viewport two pixels shorter than the
    // content measured to fit it — which is a scrollbar on a preview that fits perfectly.
    <div className={cn("w-full overflow-hidden rounded-md border bg-background", className)}>
      <iframe
        ref={frameRef}
        title="preview"
        srcDoc={SHELL}
        // `allow-same-origin` and nothing else: without it the frame gets an opaque origin and
        // `contentDocument` goes out of reach, and every other capability — scripts, forms, popups,
        // top-level navigation — stays off, which is everything a stylesheet preview needs.
        sandbox="allow-same-origin"
        style={{ height }}
        className="block w-full border-0"
      >
        {body && createPortal(children, body)}
      </iframe>
    </div>
  )
}
