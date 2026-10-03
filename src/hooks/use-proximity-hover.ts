import type { Dispatch, RefObject, SetStateAction } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

export interface ItemRect {
  top: number
  left: number
  width: number
  height: number
}

interface UseProximityHoverOptions {
  /**
   * Which direction the nearest item is resolved along.
   *   "y"  — a vertical stack (default): nearest by top/height alone.
   *   "xy" — a wrapped grid: nearest by Euclidean distance to each item's centre, so a
   *          pointer between two columns picks the column it is closest to rather than
   *          whichever item happens to share its row band.
   */
  axis?: "y" | "xy"
}

interface UseProximityHoverReturn {
  activeIndex: number | null
  /**
   * Drives the highlight from something other than the pointer. Keyboard-navigable popups
   * need it so arrowing through items moves the same highlight the mouse does, instead of
   * leaving it wherever the pointer last was.
   */
  setActiveIndex: Dispatch<SetStateAction<number | null>>
  itemRects: ItemRect[]
  /** Bumped on each pointer entry so a consumer can remount its highlight per session. */
  session: number
  handlers: {
    onMouseEnter: () => void
    onMouseMove: (event: React.MouseEvent) => void
    onMouseLeave: () => void
  }
  registerItem: (index: number, element: HTMLElement | null) => void
  /**
   * Remeasures now. Registration and container resize already schedule one, so this is
   * only for layout changes neither notices — a prop that reflows items inside a container
   * whose own box happens to stay the same size.
   */
  measureItems: () => void
}

/**
 * Frames the coalesced measurement retries while registered items still have no layout
 * box. An item can be in the DOM a frame before it is laid out; retrying beats publishing
 * zeroed rects, and the cap keeps a list that stays hidden from spinning frames forever.
 */
const MEASUREMENT_ATTEMPTS = 3

function isSameRect(a: ItemRect | undefined, b: ItemRect | undefined) {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      a.top === b.top &&
      a.left === b.left &&
      a.width === b.width &&
      a.height === b.height)
  )
}

/**
 * Tracks which item the pointer is nearest, so one moving highlight can follow it instead
 * of every item lighting up on its own `:hover`. Items register themselves by index; the
 * caller positions its highlight from `itemRects[activeIndex]`.
 *
 * Ported from fluidfunctionalism.com/docs/table.
 */
export function useProximityHover<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  { axis = "y" }: UseProximityHoverOptions = {},
): UseProximityHoverReturn {
  const itemsRef = useRef(new Map<number, HTMLElement>())
  const itemRectsRef = useRef<ItemRect[]>([])
  const [itemRects, setItemRects] = useState<ItemRect[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [session, setSession] = useState(0)
  const moveFrameRef = useRef<number | null>(null)
  const measureFrameRef = useRef<number | null>(null)

  /**
   * Publishes a rect per registered item. Returns false when the pass could not finish —
   * no container, or an item without a layout box — and publishes nothing in that case, so
   * the last complete measurement stands instead of being overwritten with zeroes.
   */
  const measure = useCallback(() => {
    if (!containerRef.current) return false

    const rects: ItemRect[] = []
    for (const [index, element] of itemsRef.current) {
      // An element inside a hidden subtree has no offsetParent and reports every offset as
      // 0. Publishing that would pin the highlight to the top of the list.
      const hasLayoutBox =
        element.offsetParent !== null || element.offsetWidth > 0 || element.offsetHeight > 0
      if (!hasLayoutBox) return false
      // offset* rather than getBoundingClientRect: these are layout values relative to the
      // offsetParent, the same coordinate space an absolutely positioned highlight uses,
      // and they are unaffected by any transform on an ancestor.
      rects[index] = {
        top: element.offsetTop,
        left: element.offsetLeft,
        width: element.offsetWidth,
        height: element.offsetHeight,
      }
    }

    // Skip the state update when nothing moved, so redundant remeasures don't re-render.
    const previous = itemRectsRef.current
    let changed = rects.length !== previous.length
    for (let index = 0; !changed && index < rects.length; index++) {
      changed = !isSameRect(rects[index], previous[index])
    }
    if (changed) {
      itemRectsRef.current = rects
      setItemRects(rects)
    }
    return true
  }, [containerRef])

  /** Coalesces every trigger — registration, resize — into one remeasure next frame. */
  const measureItems = useCallback(() => {
    let attemptsLeft = MEASUREMENT_ATTEMPTS
    const attempt = () => {
      measureFrameRef.current = null
      if (!measure() && --attemptsLeft > 0) {
        measureFrameRef.current = requestAnimationFrame(attempt)
      }
    }
    if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current)
    measureFrameRef.current = requestAnimationFrame(attempt)
  }, [measure])

  const registerItem = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (element) itemsRef.current.set(index, element)
      else itemsRef.current.delete(index)
      measureItems()
    },
    [measureItems],
  )

  // A reflow moves items even though the registered set is unchanged, which would leave
  // the published rects stale. Coalesced through the same frame as registration.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(measureItems)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, measureItems])

  useEffect(
    () => () => {
      if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current)
      if (measureFrameRef.current !== null) cancelAnimationFrame(measureFrameRef.current)
    },
    [],
  )

  const handlers = {
    onMouseEnter: () => setSession((current) => current + 1),
    onMouseMove: (event: React.MouseEvent) => {
      const { clientX: pointerX, clientY: pointerY } = event
      if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current)
      moveFrameRef.current = requestAnimationFrame(() => {
        moveFrameRef.current = null
        const container = containerRef.current
        if (!container) return

        // Item rects are layout values while the pointer lives in visual space, so an
        // ancestor `transform: scale` has to be divided back out before comparing. The two
        // axes scale independently.
        const box = container.getBoundingClientRect()
        const scaleX = container.offsetWidth > 0 ? box.width / container.offsetWidth : 1
        const scaleY = container.offsetHeight > 0 ? box.height / container.offsetHeight : 1
        const originX = box.left + (container.clientLeft - container.scrollLeft) * scaleX
        const originY = box.top + (container.clientTop - container.scrollTop) * scaleY

        let closestIndex: number | null = null
        let closestDistance = Infinity
        let containingIndex: number | null = null
        const rects = itemRectsRef.current
        for (let index = 0; index < rects.length; index++) {
          const rect = rects[index]
          if (!rect) continue
          const halfWidth = (rect.width * scaleX) / 2
          const halfHeight = (rect.height * scaleY) / 2
          // On the "y" axis every item spans the pointer's column, so only height counts.
          const dx = axis === "y" ? 0 : pointerX - (originX + rect.left * scaleX + halfWidth)
          const dy = pointerY - (originY + rect.top * scaleY + halfHeight)
          if (Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight) containingIndex = index
          const distance = Math.hypot(dx, dy)
          if (distance < closestDistance) {
            closestDistance = distance
            closestIndex = index
          }
        }
        setActiveIndex(containingIndex ?? closestIndex)
      })
    },
    onMouseLeave: () => {
      if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current)
      moveFrameRef.current = null
      setActiveIndex(null)
    },
  }

  return { activeIndex, setActiveIndex, itemRects, session, handlers, registerItem, measureItems }
}
