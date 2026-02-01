import type { RefObject } from 'react'
import type { SubtitlePosition } from '../atoms'
import { useAtom } from 'jotai'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { getContainingShadowRoot } from '@/utils/host/dom/node'
import { subtitlesPositionAtom } from '../atoms'

const BASE_FONT_RATIO = 0.03

export interface SubtitleWindowSize {
  width: number
  height: number
  fontSize: number
}

interface Rects {
  container: HTMLDivElement
  videoContainer: HTMLElement
  containerRect: DOMRect
  videoRect: DOMRect
}

interface AnchorPositionContext {
  videoRect: DOMRect
  containerRect: DOMRect
  controlsVisible: boolean
  controlsHeight: number
}

function getVideoContainer(element: HTMLElement): HTMLElement | null {
  const rootNode = getContainingShadowRoot(element)
  const shadowHost = rootNode?.host as HTMLElement | undefined
  return shadowHost?.parentElement ?? null
}

function getRects(containerRef: RefObject<HTMLDivElement | null>): Rects | null {
  const container = containerRef.current
  if (!container)
    return null

  const videoContainer = getVideoContainer(container)
  if (!videoContainer)
    return null

  return {
    container,
    videoContainer,
    containerRect: container.getBoundingClientRect(),
    videoRect: videoContainer.getBoundingClientRect(),
  }
}

function calculateAnchorPosition(ctx: AnchorPositionContext): SubtitlePosition {
  const { videoRect, containerRect, controlsVisible, controlsHeight } = ctx
  const videoHeight = videoRect.height

  const subtitleTop = containerRect.top - videoRect.top
  const subtitleCenter = subtitleTop + containerRect.height / 2
  const midPoint = videoHeight / 2

  const anchor = subtitleCenter < midPoint ? 'top' : 'bottom'

  if (anchor === 'top') {
    const percent = (subtitleTop / videoHeight) * 100
    return { percent: Math.max(0, percent), anchor: 'top' }
  }

  const subtitleBottom = videoHeight - (containerRect.bottom - videoRect.top)
  const subtitleBottomPercent = (subtitleBottom / videoHeight) * 100
  const controlsOffsetPercent = controlsVisible ? (controlsHeight / videoHeight) * 100 : 0
  const percent = subtitleBottomPercent - controlsOffsetPercent

  return { percent: Math.max(0, percent), anchor: 'bottom' }
}

export function useVerticalDrag(controlsVisible: boolean, controlsHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startY = useRef(0)
  const startPosition = useRef<SubtitlePosition>({ percent: 10, anchor: 'bottom' })
  const [position, setPosition] = useAtom(subtitlesPositionAtom)
  const [isDragging, setIsDragging] = useState(false)
  const [windowSize, setWindowSize] = useState<SubtitleWindowSize>({
    width: 0,
    height: 0,
    fontSize: 16,
  })

  const updateWindowSize = useEffectEvent(() => {
    const rects = getRects(containerRef)
    if (!rects)
      return

    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setWindowSize({
      width: rects.videoRect.width,
      height: rects.videoRect.height,
      fontSize: rects.videoRect.height * BASE_FONT_RATIO,
    })
  })

  const onMouseDown = useEffectEvent((e: MouseEvent) => {
    if (e.button !== 0)
      return
    isDraggingRef.current = true
    setIsDragging(true)
    startY.current = e.clientY
    startPosition.current = { ...position }
    e.preventDefault()
    e.stopPropagation()
  })

  const onMouseMove = useEffectEvent((e: MouseEvent) => {
    if (!isDraggingRef.current)
      return

    const rects = getRects(containerRef)
    if (!rects)
      return

    const { videoRect, containerRect } = rects
    const videoHeight = videoRect.height

    // Calculate deltaY relative to video container height
    const deltaY = e.clientY - startY.current
    const deltaPercent = (deltaY / videoHeight) * 100

    // Calculate new position based on current anchor
    const isBottomAnchor = startPosition.current.anchor === 'bottom'
    let newPercent = isBottomAnchor
      ? startPosition.current.percent - deltaPercent
      : startPosition.current.percent + deltaPercent

    // Clamp to valid range (0 to max that keeps subtitle visible)
    // Account for controls height when anchor is top
    const reservedHeight = controlsVisible && startPosition.current.anchor === 'top'
      ? controlsHeight
      : 0
    const maxPercent = ((videoHeight - containerRect.height - reservedHeight) / videoHeight) * 100
    newPercent = Math.max(0, Math.min(maxPercent, newPercent))

    setPosition({ ...startPosition.current, percent: newPercent })
  })

  const onMouseUp = useEffectEvent(() => {
    if (!isDraggingRef.current)
      return
    isDraggingRef.current = false
    setIsDragging(false)

    const rects = getRects(containerRef)
    if (!rects)
      return

    const newPosition = calculateAnchorPosition({
      videoRect: rects.videoRect,
      containerRect: rects.containerRect,
      controlsVisible,
      controlsHeight,
    })

    // Only update if anchor changed (position already correct from onMouseMove)
    if (newPosition.anchor !== position.anchor) {
      setPosition(newPosition)
    }
  })

  const clampPosition = useEffectEvent(() => {
    const rects = getRects(containerRef)
    if (!rects)
      return

    const { videoRect, containerRect } = rects
    const maxPercent = ((videoRect.height - containerRect.height) / videoRect.height) * 100
    const clampedPercent = Math.max(0, Math.min(maxPercent, position.percent))

    if (position.percent !== clampedPercent) {
      setPosition({ ...position, percent: clampedPercent })
    }
  })

  useEffect(() => {
    const handle = handleRef.current
    const rects = getRects(containerRef)
    if (!handle || !rects)
      return

    handle.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    const resizeObserver = new ResizeObserver(() => {
      updateWindowSize()
      clampPosition()
    })
    resizeObserver.observe(rects.videoContainer)

    // Initial size update
    updateWindowSize()

    return () => {
      handle.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      resizeObserver.disconnect()
    }
  }, [])

  // Calculate offset for rendering
  const controlsOffsetPercent = controlsVisible && position.anchor === 'bottom' && windowSize.height > 0
    ? (controlsHeight / windowSize.height) * 100
    : 0

  return { containerRef, handleRef, position, windowSize, isDragging, controlsOffsetPercent }
}
