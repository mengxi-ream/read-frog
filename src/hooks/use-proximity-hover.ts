import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

export interface ItemRect {
  top: number
  left: number
  width: number
  height: number
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
}

/**
 * Frames the coalesced measurement retries while registered items still have no layout
 * box. An item can be in the DOM a frame before it is laid out; retrying beats publishing
 * zeroed rects, and the cap keeps a list that stays hidden from spinning frames forever.
 */
const MEASUREMENT_ATTEMPTS = 3

/**
 * Tracks which item of a vertical stack the pointer is nearest, so one moving highlight
 * can follow it instead of every item lighting up on its own `:hover`. Items register
 * themselves by index; the caller positions its highlight from `itemRects[activeIndex]`.
 *
 * Ported from fluidfunctionalism.com/docs/table, narrowed to the vertical axis.
 */
export function useProximityHover<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
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
      const pointerY = event.clientY

      if (moveRafRef.current !== null) {
        cancelAnimationFrame(moveRafRef.current)
      }

      moveRafRef.current = requestAnimationFrame(() => {
        moveRafRef.current = null
        const container = containerRef.current
        if (!container) return

        const containerRect = container.getBoundingClientRect()
        const scrollOffset = container.scrollTop
        const borderOffset = container.clientTop
        // Item rects are layout values while the pointer lives in visual space, so an
        // ancestor `transform: scale` has to be divided back out before comparing.
        const scale = container.offsetHeight > 0 ? containerRect.height / container.offsetHeight : 1

        let closestIndex: number | null = null
        let closestDistance = Infinity
        let containingIndex: number | null = null

        const rects = itemRectsRef.current
        for (let index = 0; index < rects.length; index++) {
          const rect = rects[index]
          if (!rect) continue

          const itemTop = containerRect.top + (borderOffset + rect.top - scrollOffset) * scale
          const itemHeight = rect.height * scale
          if (pointerY >= itemTop && pointerY <= itemTop + itemHeight) {
            containingIndex = index
          }

          const distance = Math.abs(pointerY - (itemTop + itemHeight / 2))
          if (distance < closestDistance) {
            closestDistance = distance
            closestIndex = index
          }
        }

        setActiveIndex(containingIndex ?? closestIndex)
      })
    },
    [containerRef],
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

  return {
    activeIndex,
    itemRects,
    sessionRef,
    handlers: { onMouseEnter, onMouseMove, onMouseLeave },
    registerItem,
  }
}
