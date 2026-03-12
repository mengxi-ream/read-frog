/**
 * Sets up URL change detection via multiple strategies.
 * Returns a cleanup function to remove all listeners and stop polling.
 */
export function setupUrlChangeListener(signal?: AbortSignal): () => void {
  const EVENT_NAME = "extension:URLChange"

  const isSamePage = (from: string, to: string) => {
    try {
      const fromUrl = new URL(from)
      const toUrl = new URL(to)

      return fromUrl.origin === toUrl.origin
        && fromUrl.pathname === toUrl.pathname
    }
    catch {
      return false
    }
  }

  const fire = (from: string, to: string, reason: string) => {
    if (from === to)
      return

    if (isSamePage(from, to))
      return

    const ev = new CustomEvent(EVENT_NAME, { detail: { from, to, reason } })
    window.dispatchEvent(ev)
  }

  /* ---------- 1. pushState / replaceState ---------- */
  let prev = location.href
  const originals: Record<string, typeof history.pushState> = {};
  (["pushState", "replaceState"] as const).forEach((fn) => {
    const orig = history[fn]
    originals[fn] = orig
    history[fn] = function (...args) {
      orig.apply(this, args as any)
      const now = location.href
      fire(prev, now, fn)
      prev = now
    }
  })

  /* ---------- 2. popstate / hashchange ---------- */
  const onPopState = () => {
    const now = location.href
    fire(prev, now, "popstate")
    prev = now
  }
  const onHashChange = () => {
    const now = location.href
    fire(prev, now, "hashchange")
    prev = now
  }

  window.addEventListener("popstate", onPopState, { signal })
  window.addEventListener("hashchange", onHashChange, { signal })

  /* ---------- 3. Modern Navigation API (only Chrome/Edge) ---------- */
  let removeNavigateListener: (() => void) | null = null
  if ("navigation" in window) {
    const onNavigate = (e: any) => {
      const now = e.destination?.url ?? location.href
      fire(prev, now, "navigate")
      prev = now
    }
    ;(window as any).navigation.addEventListener("navigate", onNavigate, { signal })
    removeNavigateListener = () => {
      (window as any).navigation.removeEventListener("navigate", onNavigate)
    }
  }

  /* ---------- 4. Fallback polling (Firefox/Safari only) ---------- */
  let intervalId: ReturnType<typeof setInterval> | null = null
  if (!["chrome", "edge"].includes(import.meta.env.BROWSER)) {
    intervalId = setInterval(() => {
      const now = location.href
      if (now !== prev) {
        fire(prev, now, "interval")
        prev = now
      }
    }, 1000)
  }

  /* ---------- Cleanup ---------- */
  return () => {
    // Restore original history methods
    for (const fn of ["pushState", "replaceState"] as const) {
      if (originals[fn]) {
        history[fn] = originals[fn]
      }
    }

    window.removeEventListener("popstate", onPopState)
    window.removeEventListener("hashchange", onHashChange)
    removeNavigateListener?.()

    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}
