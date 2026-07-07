import "@/utils/zod-config"
import type { Config, UiLanguage } from "@/types/config/config"
import { browser, defineBackground } from "#imports"
import { env } from "@/env"
import { storageAdapter } from "@/utils/atoms/storage-adapter"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { initI18n, setUiLanguage } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { openOptionsPage } from "@/utils/navigation"
import { SessionCacheGroupRegistry } from "@/utils/session-cache/session-cache-group-registry"
import { runAiSegmentSubtitles } from "./ai-segmentation"
import { setupAnalyticsMessageHandlers } from "./analytics"
import { dispatchBackgroundStreamPort } from "./background-stream"
import { initializeActionIcons, registerActionIconListeners } from "./browser-action-icon"
import { ensureInitializedConfig } from "./config"
import { setUpConfigBackup } from "./config-backup"
import { initializeContextMenu, registerContextMenuListeners } from "./context-menu"
import { cleanupAllAiSegmentationCache, cleanupAllSummaryCache, cleanupAllTranslationCache, setUpDatabaseCleanup } from "./db-cleanup"
import { setupEdgeTTSMessageHandlers } from "./edge-tts"
import { setupIframeInjection } from "./iframe-injection"
import { setupLLMGenerateTextMessageHandlers } from "./llm-generate-text"
import { initMockData } from "./mock-data"
import { newUserGuide } from "./new-user-guide"
import { setupNotebasePendingSaveProcessor } from "./notebase-pending-save"
import { proxyFetch } from "./proxy-fetch"
import { setupSidePanelMessageHandler } from "./side-panel"
import { setUpSubtitlesTranslationQueue, setUpWebPageTranslationQueue } from "./translation-queues"
import { translationMessage } from "./translation-signal"
import { setupTTSPlaybackMessageHandlers } from "./tts-playback"
import { setupUninstallSurvey } from "./uninstall-survey"

export default defineBackground({
  type: "module",
  main: () => {
    logger.info("Hello background!", { id: browser.runtime.id })

    browser.runtime.onInstalled.addListener(async (details) => {
      await ensureInitializedConfig()

      // Open tutorial page when extension is installed
      if (details.reason === "install") {
        await browser.tabs.create({
          url: `${env.WXT_WEBSITE_URL}/guide/step-1`,
        })
      }

      // Clear blog cache on extension update to fetch latest blog posts
      if (details.reason === "update") {
        logger.info("[Background] Extension updated, clearing blog cache")
        await SessionCacheGroupRegistry.removeCacheGroup("blog-fetch")
      }
    })

    onMessage("openPage", async (message) => {
      const { url, active } = message.data
      logger.info("openPage", { url, active })
      await browser.tabs.create({ url, active: active ?? true })
    })

    onMessage("openOptionsPage", async (message) => {
      logger.info("openOptionsPage", message.data)
      await openOptionsPage(message.data)
    })

    setupSidePanelMessageHandler({
      extensionBrowser: browser,
      logger,
      registerMessageHandler: onMessage,
    })

    onMessage("aiSegmentSubtitles", async (message) => {
      try {
        return await runAiSegmentSubtitles(message.data)
      }
      catch (error) {
        logger.error("[Background] aiSegmentSubtitles failed", error)
        throw error
      }
    })

    browser.runtime.onConnect.addListener((port) => {
      dispatchBackgroundStreamPort(port)
    })

    onMessage("clearAllTranslationRelatedCache", async () => {
      await cleanupAllTranslationCache()
      await cleanupAllSummaryCache()
    })

    onMessage("clearAiSegmentationCache", async () => {
      await cleanupAllAiSegmentationCache()
    })

    newUserGuide()
    setupAnalyticsMessageHandlers()
    translationMessage()
    registerActionIconListeners()

    // Register context menu listeners synchronously
    // This ensures listeners are registered before Chrome completes initialization
    registerContextMenuListeners()

    // Initialize action icons asynchronously
    void initializeActionIcons()

    void setUpWebPageTranslationQueue()
    void setUpSubtitlesTranslationQueue()
    void setUpDatabaseCleanup()
    setUpConfigBackup()

    proxyFetch()
    setupNotebasePendingSaveProcessor()
    setupEdgeTTSMessageHandlers()
    setupLLMGenerateTextMessageHandlers()
    setupTTSPlaybackMessageHandlers()
    void initMockData()

    // Setup on-demand iframe injection after page translation is enabled.
    setupIframeInjection()

    // i18n bootstrap for the non-React background context. Runs after the synchronous
    // listener registration above (MV3 requires listeners before the first await). The
    // context menu and the uninstall-survey URL both resolve i18n.t at registration time,
    // so they must be created AFTER initI18n or they freeze in the wrong language.
    let currentUiLanguage: UiLanguage | undefined
    void (async () => {
      const config = await ensureInitializedConfig()
      currentUiLanguage = config?.uiLanguage ?? "auto"
      await initI18n(currentUiLanguage)
      void initializeContextMenu()
      await setupUninstallSurvey()
    })()

    // Keep background-resolved strings in the selected language when it changes.
    // The context menu re-creates itself via its own config watcher
    // (registerContextMenuListeners), so here we only drive the i18next singleton and
    // re-set the frozen (localized) uninstall-survey URL.
    storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, (newConfig) => {
      if (newConfig.uiLanguage === currentUiLanguage)
        return
      currentUiLanguage = newConfig.uiLanguage
      void (async () => {
        await setUiLanguage(newConfig.uiLanguage)
        await setupUninstallSurvey()
      })()
    })
  },
})
