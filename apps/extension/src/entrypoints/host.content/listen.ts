(() => {
  const EVENT_NAME = 'extension:URLChange'

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
  let prev = location.href;
  ['pushState', 'replaceState'].forEach((fn) => {
    const orig = history[fn as 'pushState']
    history[fn as 'pushState'] = function (...args) {
      orig.apply(this, args as any)
      const now = location.href
      fire(prev, now, 'pushState')
      prev = now
    }
  })

  /* ---------- 2. popstate / hashchange ---------- */
  window.addEventListener('popstate', () => {
    const now = location.href
    fire(prev, now, 'popstate')
    prev = now
  })
  window.addEventListener('hashchange', () => {
    const now = location.href
    fire(prev, now, 'hashchange')
    prev = now
  })

  /* ---------- 3. Modern Navigation API (only Chrome/Edge) ---------- */
  if ('navigation' in window) {
    (window as any).navigation.addEventListener('navigate', (e: any) => {
      const now = e.destination?.url ?? location.href
      fire(prev, now, 'navigate')
      prev = now
    })
  }

  /* ---------- 4. Fallback polling (optional, to ensure 100% coverage) ---------- */
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (!['chrome', 'edge'].includes(import.meta.env.BROWSER)) {
    setInterval(() => {
      const now = location.href
      if (now !== prev) {
        fire(prev, now, 'interval')
        prev = now
      }
    }, 1000)
  }
})()
