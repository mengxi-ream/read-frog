import type { RefObject } from "react"
import { useEffect, useState } from "react"

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function useActiveRowVisibility(
  rootRef: RefObject<HTMLElement | null>,
  activeRef: RefObject<HTMLElement | null>,
  activeIndex: number,
  following: boolean,
): boolean {
  const [activeAbove, setActiveAbove] = useState(false)

  useEffect(() => {
    if (!following || activeIndex < 0) return
    activeRef.current?.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
  }, [activeRef, following, activeIndex])

  useEffect(() => {
    if (following) {
      setActiveAbove(false)
      return undefined
    }
    const viewport = rootRef.current?.closest('[data-slot="scroll-area-viewport"]')
    if (!viewport) return undefined

    const update = () => {
      const row = activeRef.current
      if (!row) {
        setActiveAbove(false)
        return
      }
      setActiveAbove(row.getBoundingClientRect().bottom < viewport.getBoundingClientRect().top)
    }
    update()
    viewport.addEventListener("scroll", update, { passive: true })
    return () => viewport.removeEventListener("scroll", update)
  }, [rootRef, activeRef, following, activeIndex])

  return activeAbove
}
