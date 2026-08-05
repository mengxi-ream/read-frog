import { useEffect, useEffectEvent } from "react"

interface UsePreventScrollThroughOptions {
  isEnabled: boolean
  element: HTMLElement | null
}

const SCROLLABLE_OVERFLOW_Y = new Set(["auto", "scroll", "overlay"])

function isElement(node: EventTarget): node is HTMLElement {
  return "nodeType" in node && (node as Node).nodeType === Node.ELEMENT_NODE
}

/**
 * Whether this element is a scroller with room left in the wheel's direction,
 * i.e. the browser would scroll it if we let the event through.
 */
function canAbsorbWheel(node: HTMLElement, deltaY: number) {
  const { scrollTop, scrollHeight, clientHeight } = node

  // Cheapest discriminator first: most nodes have nothing to scroll, so this
  // keeps the per-wheel-event walk from hitting `getComputedStyle` at all.
  if (scrollHeight <= clientHeight) {
    return false
  }

  if (!SCROLLABLE_OVERFLOW_Y.has(getComputedStyle(node).overflowY)) {
    return false
  }

  return deltaY < 0 ? scrollTop > 0 : scrollTop + clientHeight < scrollHeight - 1
}

export function usePreventScrollThrough({ isEnabled, element }: UsePreventScrollThroughOptions) {
  const handleWheel = useEffectEvent((event: WheelEvent) => {
    if (!element) {
      return
    }

    // The listener sits on the popover body, so it also sees wheels aimed at
    // nested scrollers (e.g. the collapsible source text). Preventing those
    // would leave them scrollable only by dragging the scrollbar.
    for (const node of event.composedPath()) {
      if (node === element) {
        break
      }

      if (isElement(node) && canAbsorbWheel(node, event.deltaY)) {
        return
      }
    }

    const { scrollTop, scrollHeight, clientHeight } = element
    const isAtTop = event.deltaY < 0 && scrollTop === 0
    const isAtBottom = event.deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1

    if (isAtTop || isAtBottom) {
      event.preventDefault()
      event.stopPropagation()
    }
  })

  useEffect(() => {
    if (!isEnabled || !element) {
      return undefined
    }

    element.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      element.removeEventListener("wheel", handleWheel)
    }
  }, [element, isEnabled])
}
