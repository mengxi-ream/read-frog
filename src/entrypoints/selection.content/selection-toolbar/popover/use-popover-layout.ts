import type { Rnd } from "react-rnd"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

interface LayoutMemory {
  position: Position | null
  manualSize: Size | null
}

interface UsePopoverLayoutOptions {
  anchor: Position | null
  isVisible: boolean
}

interface UsePopoverLayoutResult {
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

export const POPOVER_DRAG_HANDLE_CLASS = "rf-selection-toolbar-popover-drag-handle"
export const POPOVER_NO_DRAG_SELECTOR = "button, input, textarea, select, option, a, [role=\"button\"], [data-rf-no-drag=\"true\"]"
export const POPOVER_RESIZE_HANDLES = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
} as const

export const POPOVER_RESIZE_HANDLE_STYLES = {
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

export function usePopoverLayout({ anchor, isVisible }: UsePopoverLayoutOptions): UsePopoverLayoutResult {
  const rndRef = useRef<Rnd | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const preferredLayoutRef = useRef<LayoutMemory>({
    position: null,
    manualSize: null,
  })
  const suppressResizeObserverRef = useRef(false)
  const isDraggingRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const cancelScheduledViewportLayout = useCallback(() => {
    if (resizeFrameRef.current === null) {
      return
    }

    cancelAnimationFrame(resizeFrameRef.current)
    resizeFrameRef.current = null
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

    preferredLayoutRef.current.position = { x: popoverRect.rect.left, y: popoverRect.rect.top }
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

    if (!preferredLayoutRef.current.position) {
      preferredLayoutRef.current.position = {
        x: popoverRect.rect.left,
        y: popoverRect.rect.top,
      }
    }

    const preferredPosition = preferredLayoutRef.current.position ?? {
      x: popoverRect.rect.left,
      y: popoverRect.rect.top,
    }
    const manualSize = preferredLayoutRef.current.manualSize
    const preferredWidth = manualSize?.width ?? popoverRect.rect.width
    const preferredHeight = manualSize?.height ?? popoverRect.rect.height

    const nextHorizontal = getViewportAxisLayout(
      preferredPosition.x,
      preferredWidth,
      window.innerWidth,
    )
    const nextVertical = getViewportAxisLayout(
      preferredPosition.y,
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

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true
    cancelScheduledViewportLayout()
    setIsDragging(true)
  }, [cancelScheduledViewportLayout])

  const handleDragStop = useCallback((position: Position) => {
    isDraggingRef.current = false
    setIsDragging(false)

    const popoverRect = getPopoverRect(rndRef)
    const nextPosition = getBoundedPosition(
      position.x,
      position.y,
      popoverRect?.rect.width ?? 0,
      popoverRect?.rect.height ?? 0,
    )

    preferredLayoutRef.current.position = nextPosition
    rndRef.current?.updatePosition(nextPosition)
    scheduleViewportLayout()
  }, [scheduleViewportLayout])

  const handleResizeStop = useCallback((element: HTMLElement, position: Position) => {
    const manualSize = {
      width: element.offsetWidth,
      height: element.offsetHeight,
    }

    preferredLayoutRef.current.position = position
    preferredLayoutRef.current.manualSize = manualSize

    rndRef.current?.updatePosition(position)
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
    preferredLayoutRef.current = {
      position: null,
      manualSize: null,
    }
    suppressResizeObserverRef.current = false
    isDraggingRef.current = false
    setIsDragging(false)
  }, [cancelScheduledViewportLayout, isVisible])

  useLayoutEffect(() => {
    if (!isVisible) {
      return
    }

    scheduleViewportLayout()
    requestAnimationFrame(() => {
      syncPreferredPositionFromElement()
    })
  }, [anchor, isVisible, scheduleViewportLayout, syncPreferredPositionFromElement])

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
    if (!isVisible || typeof ResizeObserver === "undefined") {
      return
    }

    const popoverRect = getPopoverRect(rndRef)
    if (!popoverRect) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      if (suppressResizeObserverRef.current) {
        return
      }

      if (isDraggingRef.current || !preferredLayoutRef.current.manualSize) {
        scheduleViewportLayout()
      }
    })

    resizeObserver.observe(popoverRect.element)
    return () => {
      resizeObserver.disconnect()
    }
  }, [isVisible, scheduleViewportLayout])

  useEffect(() => {
    return () => {
      cancelScheduledViewportLayout()
    }
  }, [cancelScheduledViewportLayout])

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
