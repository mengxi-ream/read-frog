import { browser, defineBackground } from '#imports'
import { WEBSITE_URL } from '@/utils/constants/url'
import { logger } from '@/utils/logger'
import { onMessage, sendMessage } from '@/utils/message'
import { SessionCacheGroupRegistry } from '@/utils/session-cache/session-cache-group-registry'
import { runAiSegmentSubtitles } from './ai-segmentation'
import { ensureInitializedConfig } from './config'
import { setUpConfigBackup } from './config-backup'
import { initializeContextMenu, registerContextMenuListeners } from './context-menu'
import { cleanupAllAiSegmentationCache, cleanupAllSummaryCache, cleanupAllTranslationCache, setUpDatabaseCleanup } from './db-cleanup'
import { handleAnalyzeSelectionPort, handleTranslateStreamPort, runAnalyzeSelectionStream } from './firefox-stream'
import { setupIframeInjection } from './iframe-injection'
import { initMockData } from './mock-data'
import { newUserGuide } from './new-user-guide'
import { proxyFetch } from './proxy-fetch'
import { setUpRequestQueue, setUpSubtitlesTranslationQueue } from './translation-queues'
import { translationMessage } from './translation-signal'
import { setupUninstallSurvey } from './uninstall-survey'

export default defineBackground({
  type: 'module',
  main: () => {
    logger.info('Hello background!', { id: browser.runtime.id })

    browser.runtime.onInstalled.addListener(async (details) => {
      await ensureInitializedConfig()

      // Open tutorial page when extension is installed
      if (details.reason === 'install') {
        await browser.tabs.create({
          url: `${WEBSITE_URL}/guide/step-1`,
        })
      }

      // Clear blog cache on extension update to fetch latest blog posts
      if (details.reason === 'update') {
        logger.info('[Background] Extension updated, clearing blog cache')
        await SessionCacheGroupRegistry.removeCacheGroup('blog-fetch')
      }
    })

    onMessage('openPage', async (message) => {
      const { url, active } = message.data
      logger.info('openPage', { url, active })
      await browser.tabs.create({ url, active: active ?? true })
    })

    onMessage('openOptionsPage', () => {
      logger.info('openOptionsPage')
      void browser.runtime.openOptionsPage()
    })

    onMessage('popupRequestReadArticle', async (message) => {
      void sendMessage('readArticle', undefined, message.data.tabId)
    })

    onMessage('analyzeSelection', async (message) => {
      try {
        return await runAnalyzeSelectionStream(message.data)
      }
      catch (error) {
        logger.error('[Background] analyzeSelection failed', error)
        throw error
      }
    })

    onMessage('aiSegmentSubtitles', async (message) => {
      try {
        return await runAiSegmentSubtitles(message.data)
      }
      catch (error) {
        logger.error('[Background] aiSegmentSubtitles failed', error)
        throw error
      }
    })

    browser.runtime.onConnect.addListener((port) => {
      if (port.name === 'analyze-selection-stream') {
        handleAnalyzeSelectionPort(port)
        return
      }

      if (port.name === 'translate-text-stream') {
        handleTranslateStreamPort(port)
      }
    })

    onMessage('clearAllTranslationRelatedCache', async () => {
      await cleanupAllTranslationCache()
      await cleanupAllSummaryCache()
    })

    onMessage('clearAiSegmentationCache', async () => {
      await cleanupAllAiSegmentationCache()
    })

    newUserGuide()
    translationMessage()

    // Register context menu listeners synchronously
    // This ensures listeners are registered before Chrome completes initialization
    registerContextMenuListeners()

    // Initialize context menu items asynchronously
    void initializeContextMenu()

    void setUpRequestQueue()
    void setUpSubtitlesTranslationQueue()
    void setUpDatabaseCleanup()
    setUpConfigBackup()
    void setupUninstallSurvey()

    proxyFetch()
    void initMockData()

    // Setup programmatic injection for iframes that Chrome's manifest-based all_frames misses
    setupIframeInjection()
  },
})
