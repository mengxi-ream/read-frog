import "@/utils/zod-config"
import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { defineContentScript, storage } from "#imports"
// import eruda from 'eruda'
import { getLocalConfig } from "@/utils/config/storage"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG, DETECTED_CODE_STORAGE_KEY } from "@/utils/constants/config"
import { getDocumentInfo } from "@/utils/content/analyze"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { isSiteEnabled } from "@/utils/site-control"
import { mountHostToast } from "./mount-host-toast"
import { bindTranslationShortcutKey } from "./translation-control/bind-translation-shortcut"
import { handleTranslationModeChange } from "./translation-control/handle-config-change"
import { registerNodeTranslationTriggers } from "./translation-control/node-translation"
import { PageTranslationManager } from "./translation-control/page-translation"
import "@/utils/crypto-polyfill"
import "./listen"

declare global {
  interface Window {
    __READ_FROG_HOST_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: ["*://*/*", "file:///*"],
  cssInjectionMode: "manifest",
  allFrames: true,
  async main(ctx) {
    // Prevent double injection (manifest-based + programmatic injection)
    if (window.__READ_FROG_HOST_INJECTED__)
      return
    window.__READ_FROG_HOST_INJECTED__ = true

    // Check global site control
    const initialConfig = await getLocalConfig()
    if (!isSiteEnabled(window.location.href, initialConfig)) {
      return
    }

    // eruda.init()
    const removeHostToast = mountHostToast()
    ctx.onInvalidated(() => {
      removeHostToast()
      window.__READ_FROG_HOST_INJECTED__ = false
    })

    void registerNodeTranslationTriggers()

    const preloadConfig = initialConfig?.translate.page.preload ?? DEFAULT_CONFIG.translate.page.preload
    const manager = new PageTranslationManager({
      root: null,
      rootMargin: `${preloadConfig.margin}px`,
      threshold: preloadConfig.threshold,
    })

    // Removed shortcutKeyManager class

    manager.registerPageTranslationTriggers()

    // For late-loading iframes: check if translation is already enabled for this tab
    let translationEnabled = false
    try {
      translationEnabled = await sendMessage("getEnablePageTranslationFromContentScript", undefined)
    }
    catch (error) {
      // Extension context may be invalidated during update, proceed without auto-start
      logger.error("Failed to check translation state:", error)
    }
    if (translationEnabled) {
      void manager.start()
    }

    const handleUrlChange = async (from: string, to: string) => {
      if (from !== to) {
        logger.info("URL changed from", from, "to", to)
        if (manager.isActive) {
          manager.stop()
        }
        // Only the top frame should detect and set language to avoid race conditions from iframes
        if (window === window.top) {
          const { detectedCodeOrUnd } = await getDocumentInfo()
          const detectedCode: LangCodeISO6393 = detectedCodeOrUnd === "und" ? "eng" : detectedCodeOrUnd
          await storage.setItem<LangCodeISO6393>(`local:${DETECTED_CODE_STORAGE_KEY}`, detectedCode)
          // Notify background script that URL has changed, let it decide whether to automatically enable translation
          void sendMessage("checkAndAskAutoPageTranslation", { url: to, detectedCodeOrUnd })
        }
      }
    }

    window.addEventListener("extension:URLChange", (e: any) => {
      const { from, to } = e.detail
      void handleUrlChange(from, to)
    })

    void bindTranslationShortcutKey(manager)

    // This may not work when the tab is not active, if so, need refresh the webpage
    storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, (newConfig, oldConfig) => {
      void bindTranslationShortcutKey(manager)

      // Auto re-translate when translation mode changes while page translation is active
      handleTranslationModeChange(newConfig, oldConfig, manager)
    })

    // Listen for translation state changes from background
    onMessage("askManagerToTogglePageTranslation", (msg) => {
      const { enabled } = msg.data
      if (enabled === manager.isActive)
        return
      enabled ? void manager.start() : manager.stop()
    })

    // Only the top frame should detect and set language to avoid race conditions from iframes
    if (window === window.top) {
      const { detectedCodeOrUnd } = await getDocumentInfo()
      const initialDetectedCode: LangCodeISO6393 = detectedCodeOrUnd === "und" ? "eng" : detectedCodeOrUnd
      await storage.setItem<LangCodeISO6393>(`local:${DETECTED_CODE_STORAGE_KEY}`, initialDetectedCode)

      // Check if auto-translation should be enabled for initial page load
      void sendMessage("checkAndAskAutoPageTranslation", { url: window.location.href, detectedCodeOrUnd })
    }
  },
})
