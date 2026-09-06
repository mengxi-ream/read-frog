import type { RefObject } from "react"
import { useEffect, useState } from "react"

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function useActiveRowVisibility(
  rootRef: RefObject<HTMLElement | null>,
  activeRow: HTMLElement | null,
  following: boolean,
): boolean {
  const [activeAbove, setActiveAbove] = useState(false)

  useEffect(() => {
    if (!following || !activeRow) return
    activeRow.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
  }, [following, activeRow])

  useEffect(() => {
    if (following || !activeRow) return undefined
    const viewport = rootRef.current?.closest('[data-slot="scroll-area-viewport"]')
    if (!viewport) return undefined

    const update = () => {
      setActiveAbove(
        activeRow.getBoundingClientRect().bottom < viewport.getBoundingClientRect().top,
      )
    }
    update()
    viewport.addEventListener("scroll", update, { passive: true })
    return () => viewport.removeEventListener("scroll", update)
  }, [rootRef, following, activeRow])

  return !following && activeRow !== null && activeAbove
}
