import type { CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Position {
  x: number
  y: number
}

interface UseDraggableOptions {
  initialPosition?: Position
  onPositionChange?: (position: Position) => void
  margin?: number
  isVisible: boolean
  boundaryRef?: React.RefObject<HTMLElement>
  axis?: 'x' | 'y' | 'both'
}

interface UseDraggableReturn {
  position: Position
  isDragging: boolean
  dragRef: React.RefObject<HTMLElement | null>
  containerRef: React.RefObject<HTMLElement | null>
  style: CSSProperties
}

/**
 * Custom hook for making elements draggable
 * @param options - Configuration options for draggable behavior
 * @returns Object containing position, drag state, ref and styles
 */
export function useDraggable(options: UseDraggableOptions): UseDraggableReturn {
  const { initialPosition = { x: 0, y: 0 }, onPositionChange, margin = 0, isVisible, boundaryRef, axis = 'both' } = options

  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 })
  const positionRef = useRef<Position>(initialPosition)
  const dragRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLElement>(null)

  // Directly manipulate DOM transform; avoid React re-rendering and browser layout re-rendering
  const updatePosition = useCallback((newPosition: Position) => {
    if (!containerRef.current) {
      return
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const containerWidth = containerRect.width
    const containerHeight = containerRect.height

    const viewportWidth = boundaryRef?.current?.clientWidth ?? window.innerWidth
    const viewportHeight = boundaryRef?.current?.clientHeight ?? window.innerHeight

    const minX = margin
    const maxX = viewportWidth - containerWidth - margin
    const minY = margin
    const maxY = viewportHeight - containerHeight - margin

    const clampedPosition = {
      x: Math.max(minX, Math.min(newPosition.x, maxX)),
      y: Math.max(minY, Math.min(newPosition.y, maxY)),
    }

    containerRef.current.style.transform = `translate(${clampedPosition.x}px, ${clampedPosition.y}px)`
    positionRef.current = clampedPosition
    onPositionChange?.(clampedPosition)
  }, [onPositionChange, margin])

  useLayoutEffect(() => {
    if (initialPosition.x !== 0 || initialPosition.y !== 0) {
      updatePosition(initialPosition)
    }
  }, [initialPosition, updatePosition])

  // Handle mouse move during drag
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isDragging) {
      const newPosition = {
        x: axis === 'y' ? 0 : event.clientX - dragOffsetRef.current.x,
        y: axis === 'x' ? 0 : event.clientY - dragOffsetRef.current.y,
      }
      updatePosition(newPosition)
    }
  }, [isDragging, updatePosition, axis])

  // Handle mouse up to end drag
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (isDragging) {
      event.stopPropagation()
    }
    setIsDragging(false)
  }, [isDragging])

  // Handle mouse down to start drag
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!dragRef.current || event.button !== 0)
      return

    dragOffsetRef.current = {
      x: event.clientX - positionRef.current.x,
      y: event.clientY - positionRef.current.y,
    }
    setIsDragging(true)

    // Prevent text selection and event propagation to video
    event.preventDefault()
    event.stopPropagation()
  }, [])

  // Add/remove event listeners for drag
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  useEffect(() => {
    const element = dragRef.current
    if (!element || !isVisible)
      return

    element.addEventListener('mousedown', handleMouseDown)
    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
    }
  }, [handleMouseDown, isVisible])

  // Monitor container height changes and update position accordingly
  useEffect(() => {
    const container = containerRef.current
    if (!container)
      return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Update position if width or height has changed
        const { width, height } = entry.contentRect
        if (width > 0 || height > 0) {
          // Use current position to trigger boundary recalculation
          updatePosition(positionRef.current)
        }
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePosition, containerRef.current])

  return {
    position: positionRef.current,
    isDragging,
    dragRef,
    containerRef,
    style: {
      position: 'fixed',
      maxHeight: `calc(100vh - ${margin * 2}px)`,
    },
  }
}
