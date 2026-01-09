import { defineContentScript } from '#imports'
import { getLocalConfig } from '@/utils/config/storage'
import { initYoutubeSubtitles } from './init-youtube-subtitles'

declare global {
  interface Window {
    __READ_FROG_SUBTITLES_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  cssInjectionMode: 'manifest',
  async main() {
    if (window.__READ_FROG_SUBTITLES_INJECTED__)
      return
    window.__READ_FROG_SUBTITLES_INJECTED__ = true

    const config = await getLocalConfig()
    if (!config?.videoSubtitles?.enabled) {
      return
    }

    initYoutubeSubtitles()
  },
})
