const timedtextUrlCache: Map<string, string> = new Map()
const timedtextUrlWaiters: Map<string, Array<(url: string) => void>> = new Map()

function cacheTimedtextUrl(url: string): void {
  if (/api\/timedtext/.test(url)) {
    const parsedUrl = new URL(url)
    const videoId = parsedUrl.searchParams.get("v")
    const pot = parsedUrl.searchParams.get("pot")
    if (videoId && pot) {
      timedtextUrlCache.set(videoId, url)

      const waiters = timedtextUrlWaiters.get(videoId)
      if (waiters) {
        waiters.forEach(resolve => resolve(url))
        timedtextUrlWaiters.delete(videoId)
      }
    }
  }
}

export function waitForTimedtextUrl(videoId: string, timeoutMs: number): Promise<string | null> {
  const cached = timedtextUrlCache.get(videoId)
  if (cached) {
    return Promise.resolve(cached)
  }

  return new Promise((resolve) => {
    const waiters = timedtextUrlWaiters.get(videoId) || []
    waiters.push(resolve)
    timedtextUrlWaiters.set(videoId, waiters)

    setTimeout(() => {
      const currentWaiters = timedtextUrlWaiters.get(videoId)
      if (currentWaiters) {
        const index = currentWaiters.indexOf(resolve)
        if (index !== -1) {
          currentWaiters.splice(index, 1)
          resolve(timedtextUrlCache.get(videoId) ?? null)
        }
      }
    }, timeoutMs)
  })
}

export function setupTimedtextObserver(): void {
  const originalXhrOpen = XMLHttpRequest.prototype.open
  const originalXhrSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
    (this as any)._url = url.toString()
    return originalXhrOpen.apply(this, [method, url, ...args] as any)
  }

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    this.addEventListener("load", function () {
      cacheTimedtextUrl(this.responseURL || (this as any)._url)
    })
    return originalXhrSend.apply(this, args as any)
  }
}

export function getCachedTimedtextUrl(videoId: string): string | null {
  return timedtextUrlCache.get(videoId) ?? null
}
