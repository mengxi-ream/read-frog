(() => {
  /** 向外抛出的统一事件名 */
  const EVENT_NAME = 'extension:urlchange'

  /** 触发自定义事件并携带前后 URL */
  const fire = (from: string, to: string, reason: string) => {
    if (from === to)
      return // 无变化
    const ev = new CustomEvent(EVENT_NAME, { detail: { from, to, reason } })
    window.dispatchEvent(ev)
  }

  /* ---------- 1. 补丁 pushState / replaceState ---------- */
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

  /* ---------- 3. 现代 Navigation API（仅 Chrome/Edge） ---------- */
  // 不拦截浏览器默认行为，只用于侦听
  if ('navigation' in window) {
    (window as any).navigation.addEventListener('navigate', (e: any) => {
      const now = e.destination?.url ?? location.href
      fire(prev, now, 'navigate')
      prev = now
    })
  }

  /* ---------- 4. 兜底轮询（可选，保证万无一失） ---------- */
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
