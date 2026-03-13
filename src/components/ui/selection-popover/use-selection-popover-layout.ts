import type { Rnd } from "react-rnd"
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from "react"

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

type VerticalLayoutMemory
  = | { mode: "top", offset: number }
    | { mode: "bottom", offset: number }

interface LayoutMemory {
  x: number | null
  vertical: VerticalLayoutMemory | null
  manualSize: Size | null
}

interface UseSelectionPopoverLayoutOptions {
  anchor: Position | null
  isVisible: boolean
}

interface UseSelectionPopoverLayoutResult {
  rndRef: React.RefObject<Rnd | null>
  isDragging: boolean
  defaultLayout: Position & { width: number, height: "auto" }
  minWidth: number
  minHeight: number
  handleDragStart: () => void
  handleDrag: (position: Position) => void
  handleDragStop: (position: Position) => void
  handleResizeStop: (element: HTMLElement, position: Position) => void
  handleWheel: (event: React.WheelEvent<HTMLElement>) => void
}

const DEFAULT_WIDTH = 500
const MIN_WIDTH = 320
const MIN_HEIGHT = 180
const BOTTOM_EDGE_TOLERANCE = 1

export const SELECTION_POPOVER_DRAG_HANDLE_CLASS = "rf-selection-popover-drag-handle"
export const SELECTION_POPOVER_NO_DRAG_SELECTOR = "button, input, textarea, select, option, a, [role=\"button\"], [data-rf-no-drag=\"true\"]"
export const SELECTION_POPOVER_RESIZE_HANDLES = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
} as const

export const SELECTION_POPOVER_RESIZE_HANDLE_STYLES = {
  top: { top: -5, height: 10, left: 8, right: 8 },
  right: { right: -5, width: 10, top: 8, bottom: 8 },
  bottom: { bottom: -5, height: 10, left: 8, right: 8 },
  left: { left: -5, width: 10, top: 8, bottom: 8 },
  topRight: { top: -6, right: -6, width: 14, height: 14 },
  bottomRight: { bottom: -6, right: -6, width: 14, height: 14 },
  bottomLeft: { bottom: -6, left: -6, width: 14, height: 14 },
  topLeft: { top: -6, left: -6, width: 14, height: 14 },
} as const

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getViewportMaxWidth() {
  return Math.max(window.innerWidth, 0)
}

function getViewportMaxHeight() {
  return Math.max(window.innerHeight, 0)
}

function getEffectiveMinWidth(maxWidth: number) {
  return Math.min(MIN_WIDTH, Math.max(maxWidth, 1))
}

function getEffectiveMinHeight(maxHeight: number) {
  return Math.min(MIN_HEIGHT, Math.max(maxHeight, 1))
}

function getInitialWidth(maxWidth: number) {
  return maxWidth > 0 ? Math.min(DEFAULT_WIDTH, maxWidth) : DEFAULT_WIDTH
}

function getInitialPosition(anchor: Position | null) {
  const maxWidth = getViewportMaxWidth()
  const initialWidth = getInitialWidth(maxWidth)
  const maxX = Math.max(0, window.innerWidth - initialWidth)
  const maxY = Math.max(0, window.innerHeight)

  return {
    x: clamp(anchor?.x ?? 0, 0, maxX),
    y: clamp(anchor?.y ?? 0, 0, maxY),
  }
}

function getBoundedPosition(x: number, y: number, width: number, height: number) {
  const maxX = Math.max(window.innerWidth - width, 0)
  const maxY = Math.max(window.innerHeight - height, 0)

  return {
    x: clamp(x, 0, maxX),
    y: clamp(y, 0, maxY),
  }
}

function getViewportAxisLayout(preferredOffset: number, preferredSize: number, viewportSize: number) {
  const size = Math.min(preferredSize, viewportSize)
  const maxOffset = Math.max(viewportSize - size, 0)

  return {
    offset: clamp(preferredOffset, 0, maxOffset),
    size,
  }
}

function createTopVerticalLayoutMemory(offset: number): VerticalLayoutMemory {
  return {
    mode: "top",
    offset: Math.max(offset, 0),
  }
}

function isAtViewportBottom(bottom: number) {
  return bottom >= window.innerHeight - BOTTOM_EDGE_TOLERANCE
}

function getVerticalLayoutMemoryForPosition(top: number, height: number): VerticalLayoutMemory {
  const bottomGap = window.innerHeight - (top + height)

  if (bottomGap <= BOTTOM_EDGE_TOLERANCE) {
    return {
      mode: "bottom",
      offset: Math.max(bottomGap, 0),
    }
  }

  return createTopVerticalLayoutMemory(top)
}

function getBottomAnchoredLayoutMemory(rect: DOMRect): VerticalLayoutMemory | null {
  if (!isAtViewportBottom(rect.bottom)) {
    return null
  }

  return {
    mode: "bottom",
    offset: Math.max(window.innerHeight - rect.bottom, 0),
  }
}

function getViewportVerticalLayout(preferredLayout: VerticalLayoutMemory, preferredSize: number, viewportSize: number) {
  const size = Math.min(preferredSize, viewportSize)
  const maxOffset = Math.max(viewportSize - size, 0)
  const preferredOffset = preferredLayout.mode === "bottom"
    ? viewportSize - size - preferredLayout.offset
    : preferredLayout.offset

  return {
    offset: clamp(preferredOffset, 0, maxOffset),
    size,
  }
}

function getPopoverRect(rndRef: React.RefObject<Rnd | null>) {
  const element = rndRef.current?.getSelfElement()
  if (!element) {
    return null
  }

  return {
    element,
    rect: element.getBoundingClientRect(),
  }
}

export function useSelectionPopoverLayout({
  anchor,
  isVisible,
}: UseSelectionPopoverLayoutOptions): UseSelectionPopoverLayoutResult {
  const rndRef = useRef<Rnd | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const resizeObserverFrameRef = useRef<number | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedElementRef = useRef<HTMLElement | null>(null)
  const preferredLayoutRef = useRef<LayoutMemory>({
    x: null,
    vertical: null,
    manualSize: null,
  })
  const suppressResizeObserverRef = useRef(false)
  const isDraggingRef = useRef(false)
  const [isDragging, setDragging] = useReducer((_state: boolean, next: boolean) => next, false)

  const cancelScheduledViewportLayout = useCallback(() => {
    if (resizeFrameRef.current === null) {
      return
    }

    cancelAnimationFrame(resizeFrameRef.current)
    resizeFrameRef.current = null
  }, [])

  const disconnectResizeObserver = useCallback(() => {
    if (resizeObserverFrameRef.current !== null) {
      cancelAnimationFrame(resizeObserverFrameRef.current)
      resizeObserverFrameRef.current = null
    }

    resizeObserverRef.current?.disconnect()
    observedElementRef.current = null
  }, [])

  const updatePositionIfNeeded = useCallback((nextPosition: Position, currentRect: DOMRect) => {
    if (nextPosition.x !== currentRect.left || nextPosition.y !== currentRect.top) {
      rndRef.current?.updatePosition(nextPosition)
    }
  }, [])

  const syncPreferredPositionFromElement = useCallback(() => {
    const popoverRect = getPopoverRect(rndRef)
    if (!popoverRect) {
      return
    }

    preferredLayoutRef.current.x = popoverRect.rect.left
    preferredLayoutRef.current.vertical = createTopVerticalLayoutMemory(popoverRect.rect.top)
  }, [])

  const clampCurrentPositionToViewport = useCallback(() => {
    const popoverRect = getPopoverRect(rndRef)
    if (!popoverRect) {
      return
    }

    const nextPosition = getBoundedPosition(
      popoverRect.rect.left,
      popoverRect.rect.top,
      popoverRect.rect.width,
      popoverRect.rect.height,
    )

    updatePositionIfNeeded(nextPosition, popoverRect.rect)
  }, [updatePositionIfNeeded])

  const handleDrag = useCallback((position: Position) => {
    const popoverRect = getPopoverRect(rndRef)
    if (!popoverRect) {
      return
    }

    const nextPosition = getBoundedPosition(
      position.x,
      position.y,
      popoverRect.rect.width,
      popoverRect.rect.height,
    )

    if (nextPosition.x !== position.x || nextPosition.y !== position.y) {
      rndRef.current?.updatePosition(nextPosition)
    }
  }, [])

  const applyViewportLayout = useCallback(() => {
    if (isDraggingRef.current) {
      return
    }

    const popoverRect = getPopoverRect(rndRef)
    if (!popoverRect) {
      return
    }

    if (preferredLayoutRef.current.x === null) {
      preferredLayoutRef.current.x = popoverRect.rect.left
    }

    if (!preferredLayoutRef.current.vertical) {
      preferredLayoutRef.current.vertical = createTopVerticalLayoutMemory(popoverRect.rect.top)
    }

    const preferredX = preferredLayoutRef.current.x ?? popoverRect.rect.left
    const preferredVertical = getBottomAnchoredLayoutMemory(popoverRect.rect)
      ?? preferredLayoutRef.current.vertical
      ?? createTopVerticalLayoutMemory(popoverRect.rect.top)
    const manualSize = preferredLayoutRef.current.manualSize
    const preferredWidth = manualSize?.width ?? popoverRect.rect.width
    const preferredHeight = manualSize?.height ?? popoverRect.rect.height

    const nextHorizontal = getViewportAxisLayout(
      preferredX,
      preferredWidth,
      window.innerWidth,
    )
    const nextVertical = getViewportVerticalLayout(
      preferredVertical,
      preferredHeight,
      window.innerHeight,
    )

    if (manualSize && (nextHorizontal.size !== popoverRect.rect.width || nextVertical.size !== popoverRect.rect.height)) {
      suppressResizeObserverRef.current = true
      rndRef.current?.updateSize({
        width: nextHorizontal.size,
        height: nextVertical.size,
      })
      requestAnimationFrame(() => {
        suppressResizeObserverRef.current = false
      })
    }

    const nextPosition = getBoundedPosition(
      nextHorizontal.offset,
      nextVertical.offset,
      nextHorizontal.size,
      nextVertical.size,
    )

    updatePositionIfNeeded(nextPosition, popoverRect.rect)
  }, [updatePositionIfNeeded])

  const scheduleViewportLayout = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      return
    }

    resizeFrameRef.current = requestAnimationFrame(() => {
      resizeFrameRef.current = null

      if (isDraggingRef.current) {
        clampCurrentPositionToViewport()
        return
      }

      applyViewportLayout()
    })
  }, [applyViewportLayout, clampCurrentPositionToViewport])

  const ensureResizeObserver = useCallback(() => {
    if (!isVisible || typeof ResizeObserver === "undefined") {
      return
    }

    const popoverRect = getPopoverRect(rndRef)
    if (!popoverRect) {
      if (resizeObserverFrameRef.current !== null) {
        return
      }

      resizeObserverFrameRef.current = requestAnimationFrame(() => {
        resizeObserverFrameRef.current = null
        ensureResizeObserver()
      })
      return
    }

    if (observedElementRef.current === popoverRect.element) {
      return
    }

    resizeObserverRef.current?.disconnect()
    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (suppressResizeObserverRef.current) {
          return
        }

        if (isDraggingRef.current) {
          return
        }

        if (!preferredLayoutRef.current.manualSize) {
          scheduleViewportLayout()
        }
      })
    }

    resizeObserverRef.current.observe(popoverRect.element)
    observedElementRef.current = popoverRect.element
  }, [isVisible, scheduleViewportLayout])

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
    cancelScheduledViewportLayout()
    setDragging(true)
  }, [cancelScheduledViewportLayout])

  const handleDragStop = useCallback((position: Position) => {
    isDraggingRef.current = false
    setDragging(false)

    const popoverRect = getPopoverRect(rndRef)
    const nextPosition = getBoundedPosition(
      position.x,
      position.y,
      popoverRect?.rect.width ?? 0,
      popoverRect?.rect.height ?? 0,
    )

    preferredLayoutRef.current.x = nextPosition.x
    preferredLayoutRef.current.vertical = getVerticalLayoutMemoryForPosition(
      nextPosition.y,
      popoverRect?.rect.height ?? 0,
    )
    rndRef.current?.updatePosition(nextPosition)
    scheduleViewportLayout()
  }, [scheduleViewportLayout])

  const handleResizeStop = useCallback((element: HTMLElement, position: Position) => {
    const manualSize = {
      width: element.offsetWidth,
      height: element.offsetHeight,
    }
    const nextPosition = getBoundedPosition(
      position.x,
      position.y,
      manualSize.width,
      manualSize.height,
    )

    preferredLayoutRef.current.x = nextPosition.x
    preferredLayoutRef.current.vertical = getVerticalLayoutMemoryForPosition(
      nextPosition.y,
      manualSize.height,
    )
    preferredLayoutRef.current.manualSize = manualSize

    rndRef.current?.updatePosition(nextPosition)
    rndRef.current?.updateSize(manualSize)
    scheduleViewportLayout()
  }, [scheduleViewportLayout])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    event.stopPropagation()
  }, [])

  useEffect(() => {
    if (isVisible) {
      return
    }

    cancelScheduledViewportLayout()
    disconnectResizeObserver()
    preferredLayoutRef.current = {
      x: null,
      vertical: null,
      manualSize: null,
    }
    suppressResizeObserverRef.current = false
    isDraggingRef.current = false
    setDragging(false)
  }, [cancelScheduledViewportLayout, disconnectResizeObserver, isVisible])

  useLayoutEffect(() => {
    if (!isVisible) {
      return
    }

    ensureResizeObserver()
    scheduleViewportLayout()
    requestAnimationFrame(() => {
      syncPreferredPositionFromElement()
    })
  }, [anchor, ensureResizeObserver, isVisible, scheduleViewportLayout, syncPreferredPositionFromElement])

  useEffect(() => {
    if (!isVisible) {
      return
    }

    const handleWindowResize = () => {
      scheduleViewportLayout()
    }

    window.addEventListener("resize", handleWindowResize)
    return () => {
      window.removeEventListener("resize", handleWindowResize)
    }
  }, [isVisible, scheduleViewportLayout])

  useEffect(() => {
    return () => {
      cancelScheduledViewportLayout()
      disconnectResizeObserver()
    }
  }, [cancelScheduledViewportLayout, disconnectResizeObserver])

  return {
    rndRef,
    isDragging,
    defaultLayout: {
      ...getInitialPosition(anchor),
      width: getInitialWidth(getViewportMaxWidth()),
      height: "auto",
    },
    minWidth: getEffectiveMinWidth(getViewportMaxWidth()),
    minHeight: getEffectiveMinHeight(getViewportMaxHeight()),
    handleDragStart,
    handleDrag,
    handleDragStop,
    handleResizeStop,
    handleWheel,
  }
}
