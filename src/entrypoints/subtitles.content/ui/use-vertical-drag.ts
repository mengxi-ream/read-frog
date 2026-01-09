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

  useEffect(() => {
    const handle = handleRef.current
    if (!handle)
      return

    handle.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      handle.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return { containerRef, handleRef, topPercent }
}
