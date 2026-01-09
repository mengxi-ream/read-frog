import { useEffect, useRef } from 'react'

export function useVerticalDrag() {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const offsetY = useRef(0)

  useEffect(() => {
    const handle = handleRef.current
    const container = containerRef.current
    if (!handle || !container)
      return

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0)
        return
      isDragging.current = true
      startY.current = e.clientY - offsetY.current
      e.preventDefault()
      e.stopPropagation()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current)
        return

      const rootNode = container.getRootNode() as ShadowRoot
      const boundary = rootNode?.host?.parentElement
      let newOffsetY = e.clientY - startY.current

      if (boundary) {
        const boundaryRect = boundary.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const minY = boundaryRect.top - (containerRect.top - offsetY.current)
        const maxY = boundaryRect.bottom - (containerRect.bottom - offsetY.current)
        newOffsetY = Math.max(minY, Math.min(newOffsetY, maxY))
      }

      offsetY.current = newOffsetY
      container.style.transform = `translateY(${offsetY.current}px)`
    }

    const onMouseUp = () => {
      isDragging.current = false
    }

    const onClick = (e: MouseEvent) => {
      e.stopPropagation()
    }

    handle.addEventListener('mousedown', onMouseDown)
    handle.addEventListener('click', onClick, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      handle.removeEventListener('mousedown', onMouseDown)
      handle.removeEventListener('click', onClick, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return { containerRef, handleRef }
}
