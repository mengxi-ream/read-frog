import type { RefObject } from "react"
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
  itemRects: ItemRect[]
  /** Bumped on each pointer entry so a consumer can remount its highlight per session. */
  sessionRef: RefObject<number>
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [itemRects, setItemRects] = useState<ItemRect[]>([])
  const itemRectsRef = useRef<ItemRect[]>([])
  const sessionRef = useRef(0)
  const moveRafRef = useRef<number | null>(null)
  const measureRafRef = useRef<number | null>(null)

  /**
   * Publishes a rect per registered item. Returns false when the pass could not finish —
   * no container, or an item without a layout box — and publishes nothing in that case, so
   * the last complete measurement stands instead of being overwritten with zeroes.
   */
  const runMeasurement = useCallback(() => {
    const container = containerRef.current
    if (!container) return false

    const rects: ItemRect[] = []
    let everyItemHasLayout = true

    itemsRef.current.forEach((element, index) => {
      // An element inside a hidden subtree has no offsetParent and reports every offset as
      // 0. Publishing that would pin the highlight to the top of the list.
      const hasLayoutBox =
        element.offsetParent !== null || element.offsetWidth > 0 || element.offsetHeight > 0
      if (!hasLayoutBox) {
        everyItemHasLayout = false
        return
      }
      // offset* rather than getBoundingClientRect: these are layout values relative to the
      // offsetParent, the same coordinate space an absolutely positioned highlight uses,
      // and they are unaffected by any transform on an ancestor.
      rects[index] = {
        top: element.offsetTop,
        left: element.offsetLeft,
        width: element.offsetWidth,
        height: element.offsetHeight,
      }
    })

    if (!everyItemHasLayout) return false

    // Skip the state update when nothing moved, so redundant remeasures don't re-render.
    const previous = itemRectsRef.current
    let changed = previous.length !== rects.length
    for (let index = 0; !changed && index < rects.length; index++) {
      const before = previous[index]
      const after = rects[index]
      if (before === after) continue
      changed =
        !before ||
        !after ||
        before.top !== after.top ||
        before.left !== after.left ||
        before.width !== after.width ||
        before.height !== after.height
    }
    if (changed) {
      itemRectsRef.current = rects
      setItemRects(rects)
    }
    return true
  }, [containerRef])

  /** Coalesces every trigger — registration, resize — into one remeasure next frame. */
  const scheduleMeasurement = useCallback(
    (attemptsLeft: number) => {
      if (measureRafRef.current !== null) {
        cancelAnimationFrame(measureRafRef.current)
      }
      measureRafRef.current = requestAnimationFrame(() => {
        measureRafRef.current = null
        if (!runMeasurement() && attemptsLeft > 1) {
          scheduleMeasurement(attemptsLeft - 1)
        }
      })
    },
    [runMeasurement],
  )

  const registerItem = useCallback(
    (index: number, element: HTMLElement | null) => {
      if (element) {
        itemsRef.current.set(index, element)
      } else {
        itemsRef.current.delete(index)
      }
      scheduleMeasurement(MEASUREMENT_ATTEMPTS)
    },
    [scheduleMeasurement],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const pointerX = event.clientX
      const pointerY = event.clientY

      if (moveRafRef.current !== null) {
        cancelAnimationFrame(moveRafRef.current)
      }

      moveRafRef.current = requestAnimationFrame(() => {
        moveRafRef.current = null
        const container = containerRef.current
        if (!container) return

        const containerRect = container.getBoundingClientRect()
        // Item rects are layout values while the pointer lives in visual space, so an
        // ancestor `transform: scale` has to be divided back out before comparing. The two
        // axes scale independently.
        const scaleX = container.offsetWidth > 0 ? containerRect.width / container.offsetWidth : 1
        const scaleY =
          container.offsetHeight > 0 ? containerRect.height / container.offsetHeight : 1

        let closestIndex: number | null = null
        let closestDistance = Infinity
        let containingIndex: number | null = null

        const rects = itemRectsRef.current
        for (let index = 0; index < rects.length; index++) {
          const rect = rects[index]
          if (!rect) continue

          const itemTop =
            containerRect.top + (container.clientTop + rect.top - container.scrollTop) * scaleY
          const itemHeight = rect.height * scaleY

          if (axis === "y") {
            if (pointerY >= itemTop && pointerY <= itemTop + itemHeight) {
              containingIndex = index
            }
            const distance = Math.abs(pointerY - (itemTop + itemHeight / 2))
            if (distance < closestDistance) {
              closestDistance = distance
              closestIndex = index
            }
            continue
          }

          const itemLeft =
            containerRect.left + (container.clientLeft + rect.left - container.scrollLeft) * scaleX
          const itemWidth = rect.width * scaleX
          if (
            pointerX >= itemLeft &&
            pointerX <= itemLeft + itemWidth &&
            pointerY >= itemTop &&
            pointerY <= itemTop + itemHeight
          ) {
            containingIndex = index
          }

          const distance = Math.hypot(
            pointerX - (itemLeft + itemWidth / 2),
            pointerY - (itemTop + itemHeight / 2),
          )
          if (distance < closestDistance) {
            closestDistance = distance
            closestIndex = index
          }
        }

        setActiveIndex(containingIndex ?? closestIndex)
      })
    },
    [axis, containerRef],
  )

  const onMouseEnter = useCallback(() => {
    sessionRef.current += 1
  }, [])

  const onMouseLeave = useCallback(() => {
    if (moveRafRef.current !== null) {
      cancelAnimationFrame(moveRafRef.current)
      moveRafRef.current = null
    }
    setActiveIndex(null)
  }, [])

  // A reflow moves items even though the registered set is unchanged, which would leave
  // the published rects stale. Coalesced through the same frame as registration.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(() => scheduleMeasurement(MEASUREMENT_ATTEMPTS))
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, scheduleMeasurement])

  useEffect(() => {
    return () => {
      if (moveRafRef.current !== null) cancelAnimationFrame(moveRafRef.current)
      if (measureRafRef.current !== null) cancelAnimationFrame(measureRafRef.current)
    }
  }, [])

  const measureItems = useCallback(() => {
    scheduleMeasurement(MEASUREMENT_ATTEMPTS)
  }, [scheduleMeasurement])

  return {
    activeIndex,
    itemRects,
    sessionRef,
    handlers: { onMouseEnter, onMouseMove, onMouseLeave },
    registerItem,
    measureItems,
  }
}
