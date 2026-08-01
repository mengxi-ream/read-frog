import { useEffect, useEffectEvent } from "react"

interface UsePreventScrollThroughOptions {
  isEnabled: boolean
  element: HTMLElement | null
}

export function usePreventScrollThrough({ isEnabled, element }: UsePreventScrollThroughOptions) {
  const handleWheel = useEffectEvent((event: WheelEvent) => {
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
    if (!isEnabled || !element) {
      return undefined
    }

    element.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      element.removeEventListener("wheel", handleWheel)
    }
  }, [element, isEnabled])
}
