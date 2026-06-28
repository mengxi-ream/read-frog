import "@/utils/zod-config"
import { defineContentScript } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"

declare global {
  interface Window {
    __READ_FROG_SUBTITLES_INJECTED__?: boolean
  }
}

const NETFLIX_WATCH_PATH_PATTERN = /^\/watch\//
const URL_CHANGE_EVENT = "extension:URLChange"

function isNetflixPage(): boolean {
  return /(?:^|\.)netflix\.com$/i.test(window.location.hostname)
}

function isNetflixWatchPage(): boolean {
  return isNetflixPage() && NETFLIX_WATCH_PATH_PATTERN.test(window.location.pathname)
}

function watchNetflixUrlChanges(): () => void {
  let previousUrl = window.location.href

  // ponytail: Netflix SPA polling, replace with a shared idempotent history listener if latency matters.
  const intervalId = setInterval(() => {
    const currentUrl = window.location.href
    if (currentUrl === previousUrl)
      return

    const from = previousUrl
    previousUrl = currentUrl
    window.dispatchEvent(new CustomEvent(URL_CHANGE_EVENT, {
      detail: { from, to: currentUrl, reason: "interval" },
    }))
  }, 500)

  return () => clearInterval(intervalId)
}

export default defineContentScript({
  matches: ["*://*.youtube.com/*", "*://*.youtube-nocookie.com/*", "*://*.netflix.com/*"],
  allFrames: true,
  cssInjectionMode: "manifest",
  async main(ctx) {
    if (window.__READ_FROG_SUBTITLES_INJECTED__)
      return

    const config = await getLocalConfig()
    if (!config?.videoSubtitles?.enabled) {
      window.__READ_FROG_SUBTITLES_INJECTED__ = false
      return
    }

    const cleanupHandlers: Array<() => void> = []

    ctx.onInvalidated(() => {
      cleanupHandlers.forEach(cleanup => cleanup())
      window.__READ_FROG_SUBTITLES_INJECTED__ = false
    })

    const bootstrapRuntime = async () => {
      if (window.__READ_FROG_SUBTITLES_INJECTED__)
        return

      window.__READ_FROG_SUBTITLES_INJECTED__ = true
      const { bootstrapSubtitlesRuntime } = await import("./runtime")
      await bootstrapSubtitlesRuntime()
    }

    if (isNetflixPage()) {
      cleanupHandlers.push(watchNetflixUrlChanges())

      if (!isNetflixWatchPage()) {
        const handleUrlChange = () => {
          if (!isNetflixWatchPage())
            return
          window.removeEventListener(URL_CHANGE_EVENT, handleUrlChange)
          void bootstrapRuntime()
        }
        window.addEventListener(URL_CHANGE_EVENT, handleUrlChange)
        cleanupHandlers.push(() => window.removeEventListener(URL_CHANGE_EVENT, handleUrlChange))
        window.__READ_FROG_SUBTITLES_INJECTED__ = false
        return
      }
    }

    await bootstrapRuntime()
  },
})
