import { useEffect, useEffectEvent } from "react"

interface UseDismissOnOutsideMousedownOptions {
  isEnabled: boolean
  getElement: () => HTMLElement | null
  onDismiss: () => void
}

export function useDismissOnOutsideMousedown({
  isEnabled,
  getElement,
  onDismiss,
}: UseDismissOnOutsideMousedownOptions) {
  const handlePointerDown = useEffectEvent((event: MouseEvent) => {
    const element = getElement()
    if (!element) {
      return
    }

    const eventPath = event.composedPath()
    if (!eventPath.includes(element)) {
      onDismiss()
    }
  })

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
    }
  }, [isEnabled])
}
