import type { RefObject } from "react"
import { useEffect, useState } from "react"

const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]

interface FollowIntent {
  following: boolean
  resume: () => void
  intentProps: {
    onWheel: () => void
    onTouchMove: () => void
    onKeyDown: (event: React.KeyboardEvent) => void
  }
}

export function useFollowIntent(
  rootRef: RefObject<HTMLElement | null>,
  hasLines: boolean,
): FollowIntent {
  const [following, setFollowing] = useState(true)

  useEffect(() => {
    const scrollbar = rootRef.current
      ?.closest('[data-slot="scroll-area"]')
      ?.querySelector('[data-slot="scroll-area-scrollbar"]')
    if (!scrollbar) return undefined

    const stop = () => setFollowing(false)
    scrollbar.addEventListener("pointerdown", stop)
    return () => scrollbar.removeEventListener("pointerdown", stop)
  }, [rootRef, hasLines])

  const stopFollowing = () => setFollowing(false)

  return {
    following,
    resume: () => setFollowing(true),
    intentProps: {
      onWheel: stopFollowing,
      onTouchMove: stopFollowing,
      onKeyDown: (event) => {
        if (SCROLL_KEYS.includes(event.key)) {
          stopFollowing()
        }
      },
    },
  }
}
