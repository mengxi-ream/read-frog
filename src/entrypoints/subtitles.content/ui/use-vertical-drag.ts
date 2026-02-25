import type { RefObject } from "react"
import type { SubtitlePosition } from "../atoms"
import { useAtom } from "jotai"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { DEFAULT_SUBTITLE_POSITION } from "@/utils/constants/subtitles"
import { getContainingShadowRoot } from "@/utils/host/dom/node"
import { subtitlesPositionAtom } from "../atoms"

const BASE_FONT_RATIO = 0.03

interface SubtitleWindowStyle {
  width: number
  height: number
  fontSize: number
}

export interface SubtitlePositionStyle {
  top?: string
  bottom?: string
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

  const anchor = subtitleCenter < midPoint ? "top" : "bottom"

  if (anchor === "top") {
    const percent = (subtitleTop / videoHeight) * 100
    return { percent: Math.max(0, percent), anchor: "top" }
  }

  const subtitleBottom = videoHeight - (containerRect.bottom - videoRect.top)
  const subtitleBottomPercent = (subtitleBottom / videoHeight) * 100
  const controlsOffsetPercent = controlsVisible ? (controlsHeight / videoHeight) * 100 : 0
  const percent = subtitleBottomPercent - controlsOffsetPercent

  return { percent: Math.max(0, percent), anchor: "bottom" }
}

export function useVerticalDrag(controlsVisible: boolean, controlsHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startPositionRef = useRef<SubtitlePosition>(DEFAULT_SUBTITLE_POSITION)
  const [position, setPosition] = useAtom(subtitlesPositionAtom)
  const [isDragging, setIsDragging] = useState(false)
  const [windowStyle, setWindowStyle] = useState<SubtitleWindowStyle>({
    width: 0,
    height: 0,
    fontSize: 16,
  })

  const updateWindowStyle = useEffectEvent(() => {
    const rects = getRects(containerRef)
    if (!rects)
      return

    setWindowStyle({
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
    startYRef.current = e.clientY
    startPositionRef.current = { ...position }
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
    const deltaY = e.clientY - startYRef.current
    const deltaPercent = (deltaY / videoHeight) * 100

    // Calculate new position based on current anchor
    const isBottomAnchor = startPositionRef.current.anchor === "bottom"
    let newPercent = isBottomAnchor
      ? startPositionRef.current.percent - deltaPercent
      : startPositionRef.current.percent + deltaPercent

    const reservedHeight = controlsVisible && startPositionRef.current.anchor === "bottom"
      ? controlsHeight
      : 0
    const maxPercent = ((videoHeight - containerRect.height - reservedHeight) / videoHeight) * 100
    newPercent = Math.max(0, Math.min(maxPercent, newPercent))

    // Check if we need to switch anchor (crossed midline)
    const newAnchorPosition = calculateAnchorPosition({
      videoRect,
      containerRect,
      controlsVisible,
      controlsHeight,
    })

    // If anchor changed, update start position and reset drag origin
    if (newAnchorPosition.anchor !== startPositionRef.current.anchor) {
      startPositionRef.current = newAnchorPosition
      startYRef.current = e.clientY
      setPosition(newAnchorPosition)
      return
    }

    setPosition({ ...startPositionRef.current, percent: newPercent })
  })

  const onMouseUp = useEffectEvent(() => {
    if (!isDraggingRef.current)
      return
    isDraggingRef.current = false
    setIsDragging(false)
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

  const setupListeners = useEffectEvent(() => {
    const handle = handleRef.current
    const container = containerRef.current
    if (!handle || !container)
      return

    const videoContainer = getVideoContainer(container)

    handle.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)

    const resizeObserver = new ResizeObserver(() => {
      updateWindowStyle()
      clampPosition()
    })

    if (videoContainer) {
      resizeObserver.observe(videoContainer)
      updateWindowStyle()
    }

    return () => {
      handle.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      resizeObserver.disconnect()
    }
  })

  useEffect(() => {
    return setupListeners()
  }, [])

  const controlsOffsetPercent = controlsVisible && position.anchor === "bottom" && windowStyle.height > 0
    ? (controlsHeight / windowStyle.height) * 100
    : 0

  const positionStyle: SubtitlePositionStyle = position.anchor === "top"
    ? { top: `${position.percent}%`, bottom: "unset" }
    : { bottom: `${position.percent + controlsOffsetPercent}%`, top: "unset" }

  return {
    refs: { container: containerRef, handle: handleRef },
    windowStyle,
    positionStyle,
    isDragging,
  }
}
