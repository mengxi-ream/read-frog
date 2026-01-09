import { useAtom } from 'jotai'
import { useEffect, useEffectEvent, useRef } from 'react'
import { getContainingShadowRoot } from '@/utils/host/dom/node'
import { subtitlesTopPercentAtom } from '../atoms'

export function useVerticalDrag() {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startPercent = useRef(0)
  const [topPercent, setTopPercent] = useAtom(subtitlesTopPercentAtom)

  const onMouseDown = useEffectEvent((e: MouseEvent) => {
    if (e.button !== 0)
      return
    isDragging.current = true
    startY.current = e.clientY
    startPercent.current = topPercent
    e.preventDefault()
    e.stopPropagation()
  })

  const onMouseMove = useEffectEvent((e: MouseEvent) => {
    const container = containerRef.current
    if (!isDragging.current || !container)
      return

    const rootNode = getContainingShadowRoot(container)
    const boundary = rootNode?.host?.parentElement
    if (!boundary)
      return

    const boundaryRect = boundary.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const boundaryHeight = boundaryRect.height
    const containerHeight = containerRect.height

    const deltaPercent = ((e.clientY - startY.current) / boundaryHeight) * 100
    const newPercent = startPercent.current + deltaPercent

    const maxPercent = ((boundaryHeight - containerHeight) / boundaryHeight) * 100
    setTopPercent(Math.max(0, Math.min(maxPercent, newPercent)))
  })

  const onMouseUp = useEffectEvent(() => {
    isDragging.current = false
  })

  const clampTopPercent = useEffectEvent(() => {
    const container = containerRef.current
    if (!container)
      return

    const rootNode = getContainingShadowRoot(container)
    const boundary = rootNode?.host?.parentElement
    if (!boundary)
      return

    const boundaryHeight = boundary.getBoundingClientRect().height
    const containerHeight = container.getBoundingClientRect().height
    const maxPercent = ((boundaryHeight - containerHeight) / boundaryHeight) * 100

    const clampedPercent = Math.max(0, Math.min(maxPercent, topPercent))
    if (topPercent !== clampedPercent) {
      setTopPercent(clampedPercent)
    }
  })

  useEffect(() => {
    const handle = handleRef.current
    const container = containerRef.current
    if (!handle || !container)
      return

    const rootNode = getContainingShadowRoot(container)
    const boundary = rootNode?.host?.parentElement

    handle.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    const resizeObserver = new ResizeObserver(clampTopPercent)
    if (boundary) {
      resizeObserver.observe(boundary)
    }

    return () => {
      handle.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      resizeObserver.disconnect()
    }
  }, [])

  return { containerRef, handleRef, topPercent }
}
