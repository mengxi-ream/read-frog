import type { RefObject } from "react"
import { useEffect, useEffectEvent } from "react"

interface UsePreventScrollThroughOptions {
  isEnabled: boolean
  elementRef: RefObject<HTMLElement | null>
}

export function usePreventScrollThrough({
  isEnabled,
  elementRef,
}: UsePreventScrollThroughOptions) {
  const handleWheel = useEffectEvent((event: WheelEvent) => {
    const element = elementRef.current
    if (!element) {
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = element
    const isAtTop = event.deltaY < 0 && scrollTop === 0
    const isAtBottom = event.deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1

    if (isAtTop || isAtBottom) {
      event.preventDefault()
      event.stopPropagation()
    }
  })

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    const element = elementRef.current
    if (!element) {
      return
    }

    element.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      element.removeEventListener("wheel", handleWheel)
    }
  }, [elementRef, isEnabled])
}
