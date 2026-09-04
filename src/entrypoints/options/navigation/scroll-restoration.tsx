import { useEffect, useLayoutEffect, useRef } from "react"
import { NavigationType, useLocation, useNavigationType } from "react-router"

/** Scroll offset of every history entry visited in this page session, keyed by `location.key`. */
const scrollOffsets = new Map<string, number>()

/** How many frames a restore keeps re-applying itself while the route is still growing. */
const RESTORE_FRAME_BUDGET = 20

/**
 * Scroll behaviour for the whole options app: a new page opens at the top, and going back lands
 * where the user left off.
 *
 * React Router only ships `<ScrollRestoration>` for data routers and this app runs on
 * `<HashRouter>`, so without this every navigation inherits the previous page's offset — drilling
 * into a detail page from halfway down a long page opens it halfway down too.
 */
export function ScrollRestoration() {
  const { key, pathname } = useLocation()
  const navigationType = useNavigationType()
  const currentKeyRef = useRef(key)
  // oxlint-disable-next-line react/refs -- latest-value ref: writing it during render is what keeps callbacks in sync
  currentKeyRef.current = key
  const previousPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    // The browser restores scroll on its own schedule, which races with React rendering the route
    // and settles on a clamped offset. Own it instead.
    const browserBehavior = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"
    return () => {
      window.history.scrollRestoration = browserBehavior
    }
  }, [])

  useEffect(() => {
    const recordOffset = () => {
      scrollOffsets.set(currentKeyRef.current, window.scrollY)
    }
    window.addEventListener("scroll", recordOffset, { passive: true })
    return () => window.removeEventListener("scroll", recordOffset)
  }, [])

  useLayoutEffect(() => {
    const previousPathname = previousPathnameRef.current
    previousPathnameRef.current = pathname

    const target = resolveScrollTarget({
      navigationType,
      savedOffset: scrollOffsets.get(key),
      pathname,
      previousPathname,
    })
    if (target === null) {
      return undefined
    }
    return scrollToOffset(target)
  }, [key, pathname, navigationType])

  return null
}

/**
 * Where a navigation should leave the page, or `null` to leave the current offset untouched.
 *
 * @param previousPathname - The pathname of the render before this one, `null` on first render.
 */
export function resolveScrollTarget({
  navigationType,
  savedOffset,
  pathname,
  previousPathname,
}: {
  navigationType: NavigationType
  savedOffset: number | undefined
  pathname: string
  previousPathname: string | null
}): number | null {
  // First render: whatever the browser restored after a reload is the best guess available.
  if (previousPathname === null) {
    return null
  }

  // Back / forward — including the detail pages' back control, which pops its own entry.
  if (navigationType === NavigationType.Pop) {
    return savedOffset ?? 0
  }

  // Same page, new entry: a section deep link or a selection kept in the query string. The offset
  // belongs to whoever triggered it.
  if (pathname === previousPathname) {
    return null
  }

  return 0
}

/**
 * Scroll to `offset`, re-applying it for a few frames while the route is still growing: a restored
 * page renders its lazy chunk and query data over the next frames, and until it does the document
 * is too short to reach the saved offset. Stops the moment the user scrolls themselves.
 */
function scrollToOffset(offset: number): (() => void) | undefined {
  window.scrollTo(0, offset)
  if (offset <= 0) {
    return undefined
  }

  const controller = new AbortController()
  const stop = () => controller.abort()
  const listenerOptions = { signal: controller.signal, passive: true } as const
  window.addEventListener("wheel", stop, listenerOptions)
  window.addEventListener("touchstart", stop, listenerOptions)
  window.addEventListener("keydown", stop, listenerOptions)

  let remainingFrames = RESTORE_FRAME_BUDGET
  const reapply = () => {
    if (controller.signal.aborted) {
      return
    }
    if (window.scrollY >= offset || remainingFrames-- <= 0) {
      stop()
      return
    }
    window.scrollTo(0, offset)
    requestAnimationFrame(reapply)
  }
  requestAnimationFrame(reapply)

  return stop
}
