import type { RefObject } from "react"
import { useEffect, useState } from "react"

const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]

interface FollowIntent {
  following: boolean
  resume: () => void
  intentProps: {
    onWheel: () => void
    onTouchMove: () => void
  }
}

interface FollowState {
  transcriptKey: string | null
  following: boolean
}

export function useFollowIntent(
  rootRef: RefObject<HTMLElement | null>,
  transcriptKey: string | null,
  hasLines: boolean,
): FollowIntent {
  const [state, setState] = useState<FollowState>({ transcriptKey, following: true })
  const following = state.transcriptKey === transcriptKey ? state.following : true
  const setFollowing = (next: boolean) => setState({ transcriptKey, following: next })

  useEffect(() => {
    if (!hasLines) return undefined
    const scrollArea = rootRef.current?.closest('[data-slot="scroll-area"]')
    const viewport = scrollArea?.querySelector('[data-slot="scroll-area-viewport"]')
    const scrollbar = scrollArea?.querySelector('[data-slot="scroll-area-scrollbar"]')
    if (!viewport && !scrollbar) return undefined

    const stop = () => setState({ transcriptKey, following: false })
    const stopOnScrollKey = (event: Event) => {
      if (event instanceof KeyboardEvent && SCROLL_KEYS.includes(event.key)) {
        stop()
      }
    }
    viewport?.addEventListener("keydown", stopOnScrollKey)
    scrollbar?.addEventListener("pointerdown", stop)
    return () => {
      viewport?.removeEventListener("keydown", stopOnScrollKey)
      scrollbar?.removeEventListener("pointerdown", stop)
    }
  }, [rootRef, transcriptKey, hasLines])

  return {
    following,
    resume: () => setFollowing(true),
    intentProps: {
      onWheel: () => setFollowing(false),
      onTouchMove: () => setFollowing(false),
    },
  }
}
