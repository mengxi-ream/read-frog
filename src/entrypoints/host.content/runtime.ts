import type { ContentScriptContext } from "#imports"
import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { storage } from "#imports"
import { DEFAULT_CONFIG, DETECTED_CODE_STORAGE_KEY } from "@/utils/constants/config"
import { getDocumentInfo } from "@/utils/content/analyze"
import { ensurePresetStyles } from "@/utils/host/translate/ui/style-injector"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { clearEffectiveSiteControlUrl } from "@/utils/site-control"
import { setupUrlChangeListener } from "./listen"
import { mountHostToast } from "./mount-host-toast"
import { bindTranslationShortcutKey } from "./translation-control/bind-translation-shortcut"
import { registerNodeTranslationTriggers } from "./translation-control/node-translation"
import { PageTranslationManager } from "./translation-control/page-translation"

export async function bootstrapHostContent(ctx: ContentScriptContext, initialConfig: Config | null) {
  ensurePresetStyles(document)

  const cleanupUrlListener = setupUrlChangeListener()

  const removeHostToast = window === window.top ? mountHostToast() : () => {}

  const teardownNodeTranslation = registerNodeTranslationTriggers()

  const preloadConfig = initialConfig?.translate.page.preload ?? DEFAULT_CONFIG.translate.page.preload
  const manager = new PageTranslationManager({
    root: null,
    rootMargin: `${preloadConfig.margin}px`,
    threshold: preloadConfig.threshold,
  })

  const cleanupPageTranslationTriggers = manager.registerPageTranslationTriggers()

  const cleanupTranslationShortcut = await bindTranslationShortcutKey(manager)

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

  const handleExtensionUrlChange = (e: any) => {
    const { from, to } = e.detail
    void handleUrlChange(from, to)
  }
  window.addEventListener("extension:URLChange", handleExtensionUrlChange)

  // Listen for translation state changes from background
  const cleanupTranslationStateListener = onMessage("askManagerToTogglePageTranslation", (msg) => {
    const { enabled, analyticsContext } = msg.data
    if (enabled === manager.isActive)
      return
    enabled ? void manager.start(window === window.top ? analyticsContext : undefined) : manager.stop()
  })

  ctx.onInvalidated(() => {
    removeHostToast()
    cleanupUrlListener()
    teardownNodeTranslation()
    cleanupPageTranslationTriggers()
    cleanupTranslationShortcut()
    cleanupTranslationStateListener()
    window.removeEventListener("extension:URLChange", handleExtensionUrlChange)
    window.__READ_FROG_HOST_INJECTED__ = false
    clearEffectiveSiteControlUrl()
  })

  // Only the top frame should detect and set language to avoid race conditions from iframes
  if (window === window.top) {
    const { detectedCodeOrUnd } = await getDocumentInfo()
    const initialDetectedCode: LangCodeISO6393 = detectedCodeOrUnd === "und" ? "eng" : detectedCodeOrUnd
    await storage.setItem<LangCodeISO6393>(`local:${DETECTED_CODE_STORAGE_KEY}`, initialDetectedCode)

    // Check if auto-translation should be enabled for initial page load
    void sendMessage("checkAndAskAutoPageTranslation", { url: window.location.href, detectedCodeOrUnd })
  }
}
