import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { findNearestAncestorBlockNodeAt } from "@/utils/host/dom/find"

// The ring sits this far outside the block, so it never covers the text it frames.
const OUTLINE_GAP_PX = 4
// How long the ring takes to move from one block to the next.
const OUTLINE_GLIDE_MS = 180
// How long the pointer stays on a block around the ringed one before the ring grows to it.
// The gap between two paragraphs belongs to their container: crossing it would otherwise
// flash the ring out to the whole article and back.
const OUTLINE_GROW_DELAY_MS = 150

// The muted-foreground gray of host-theme.css, the in-page spinner's color: quiet, and
// readable on light and dark pages alike.
const OUTLINE_CSS = `
.outline {
  --ring: oklch(0.556 0 0);
  position: fixed;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border: 2px solid var(--ring);
  border-radius: 6px;
  background: color-mix(in oklab, var(--ring) 8%, transparent);
  pointer-events: none;
  opacity: 0;
  transition: opacity 120ms ease-out;
}
@media (prefers-color-scheme: dark) {
  .outline {
    --ring: oklch(0.708 0 0);
  }
}
.outline[data-visible] {
  opacity: 1;
}
@media (prefers-reduced-motion: no-preference) {
  .outline[data-visible][data-glide] {
    transition:
      opacity 120ms ease-out,
      transform ${OUTLINE_GLIDE_MS}ms cubic-bezier(0.2, 0, 0, 1),
      width ${OUTLINE_GLIDE_MS}ms cubic-bezier(0.2, 0, 0, 1),
      height ${OUTLINE_GLIDE_MS}ms cubic-bezier(0.2, 0, 0, 1);
  }
}
`

export interface OutlineBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Where the ring goes around a block at `rect`. An edge past the viewport stays there, so a
 * block taller than the screen reads as one that goes on; an edge on screen keeps its ring on
 * screen, even where the gap would push it off.
 */
export function getOutlineBox(
  rect: Pick<DOMRectReadOnly, "left" | "top" | "right" | "bottom">,
  viewport: { width: number; height: number },
): OutlineBox {
  const left = Math.max(rect.left - OUTLINE_GAP_PX, Math.min(rect.left, 0))
  const top = Math.max(rect.top - OUTLINE_GAP_PX, Math.min(rect.top, 0))
  const right = Math.min(rect.right + OUTLINE_GAP_PX, Math.max(rect.right, viewport.width))
  const bottom = Math.min(rect.bottom + OUTLINE_GAP_PX, Math.max(rect.bottom, viewport.height))
  return { left, top, width: right - left, height: bottom - top }
}

function isSameBox(a: OutlineBox | null, b: OutlineBox): boolean {
  return (
    a !== null &&
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  )
}

export interface NodeTranslationPreview {
  /** Rings the block at `point`, or moves the ring there. */
  show: (point: Point, config: Config) => void
  /** Hides the ring, and returns the block it framed. */
  hide: () => Element | null
  /** Hides the ring and takes it out of the page. */
  destroy: () => void
}

/**
 * The ring a held hover-translation hotkey draws around the block it is about to translate.
 *
 * It finds the block exactly as translation does — a paragraph, or the whole article when the
 * pointer rests in the article's margin — and a release translates the block it frames. It
 * lives in a closed shadow root under `<html>`: the page's styles cannot reach it, and page
 * translation's observer never sees it move.
 */
export function createNodeTranslationPreview(): NodeTranslationPreview {
  let host: HTMLElement | null = null
  let outline: HTMLElement | null = null

  let target: { point: Point; config: Config } | null = null
  let framedBlock: Element | null = null
  let placedBox: OutlineBox | null = null
  let glideEndsAt = 0
  let growing: { block: Element; since: number } | null = null
  let growTimer: ReturnType<typeof setTimeout> | null = null
  let frameId: number | null = null
  let followAbort: AbortController | null = null

  const ensureOutline = (): HTMLElement | null => {
    if (host?.isConnected && outline) return outline

    const root = document.documentElement
    if (!root) return null

    if (!host || !outline) {
      host = document.createElement("div")
      host.className = NOTRANSLATE_CLASS
      host.setAttribute("translate", "no")
      // A 0x0 box at the corner, so hit-testing and the paragraph finder walk past it.
      host.style.cssText = `
        all: initial !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 0 !important;
        height: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
      `
      const shadowRoot = host.attachShadow({ mode: "closed" })
      const style = document.createElement("style")
      style.textContent = OUTLINE_CSS
      outline = document.createElement("div")
      outline.className = "outline"
      shadowRoot.append(style, outline)
    }

    root.append(host)
    // Settle the hidden style first, so the first ring fades in instead of popping.
    void getComputedStyle(outline).opacity
    return outline
  }

  const clearGrowTimer = () => {
    if (growTimer) {
      clearTimeout(growTimer)
      growTimer = null
    }
  }

  const hideOutline = () => {
    outline?.removeAttribute("data-visible")
    framedBlock = null
    placedBox = null
    growing = null
    clearGrowTimer()
  }

  // Whether the ring should stay on the framed block a little longer before growing to `block`.
  const isWaitingToGrow = (block: Element): boolean => {
    if (!framedBlock?.isConnected || block === framedBlock || !block.contains(framedBlock)) {
      growing = null
      return false
    }

    const now = performance.now()
    if (growing?.block !== block) growing = { block, since: now }
    const wait = growing.since + OUTLINE_GROW_DELAY_MS - now
    if (wait <= 0) {
      growing = null
      return false
    }

    clearGrowTimer()
    growTimer = setTimeout(() => {
      growTimer = null
      scheduleRender()
    }, wait)
    return true
  }

  const render = () => {
    frameId = null
    if (!target) return

    const found = findNearestAncestorBlockNodeAt(target.point, target.config)
    const block = found && isWaitingToGrow(found) ? framedBlock : found
    const rect = block?.getBoundingClientRect()
    if (!block || !rect || (rect.width === 0 && rect.height === 0)) {
      hideOutline()
      return
    }

    const viewport = document.documentElement
    const box = getOutlineBox(rect, { width: viewport.clientWidth, height: viewport.clientHeight })
    if (block === framedBlock && isSameBox(placedBox, box)) return

    const element = ensureOutline()
    if (!element) return

    // Glide when the ring moves to another block. When the same block moves under it, as on
    // scroll, the ring stays on the block, unless a glide is still on its way.
    const isVisible = element.hasAttribute("data-visible")
    if (isVisible && block !== framedBlock) {
      glideEndsAt = performance.now() + OUTLINE_GLIDE_MS
    }
    if (isVisible && performance.now() < glideEndsAt) {
      element.setAttribute("data-glide", "")
    } else {
      element.removeAttribute("data-glide")
    }

    element.style.transform = `translate(${box.left}px, ${box.top}px)`
    element.style.width = `${box.width}px`
    element.style.height = `${box.height}px`
    element.setAttribute("data-visible", "")
    framedBlock = block
    placedBox = box
  }

  const scheduleRender = () => {
    if (frameId === null) frameId = requestAnimationFrame(render)
  }

  const hide = () => {
    const block = framedBlock
    target = null
    if (frameId !== null) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
    followAbort?.abort()
    followAbort = null
    hideOutline()
    return block
  }

  return {
    show: (point, config) => {
      target = { point: { ...point }, config }

      // Scrolling or resizing moves blocks under a still pointer.
      if (!followAbort) {
        followAbort = new AbortController()
        const options = { capture: true, passive: true, signal: followAbort.signal }
        window.addEventListener("scroll", scheduleRender, options)
        window.addEventListener("resize", scheduleRender, options)
      }

      scheduleRender()
    },
    hide,
    destroy: () => {
      hide()
      host?.remove()
      host = null
      outline = null
    },
  }
}
