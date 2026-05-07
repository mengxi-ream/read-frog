import type { FeatureUsageContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import { browser, storage } from "#imports"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { getTranslationStateKey } from "@/utils/constants/storage-keys"
import { shouldEnableAutoTranslation } from "@/utils/host/translate/auto-translation"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { injectHostContentIntoCurrentTabIframesAfterNodeTranslation, injectHostContentIntoTabIframes } from "./iframe-injection"
import { getPageTranslationEnabled, setPageTranslationEnabled } from "./page-translation-state"

function notifyPageTranslationStateChanged(tabId: number, enabled: boolean) {
  void sendMessage("notifyTranslationStateChanged", { enabled }, tabId)
    .catch(error => logger.warn("Failed to notify page translation state change", error))
}

function requestManagerToTogglePageTranslation(
  tabId: number,
  enabled: boolean,
  analyticsContext?: FeatureUsageContext,
) {
  void sendMessage("askManagerToTogglePageTranslation", { enabled, analyticsContext }, tabId)
    .catch(error => logger.warn("Failed to ask page translation manager to toggle", error))
}

export function translationMessage() {
  onMessage("getEnablePageTranslationByTabId", async (msg) => {
    const { tabId } = msg.data
    return await getTranslationState(tabId)
  })

  onMessage("getEnablePageTranslationFromContentScript", async (msg) => {
    const tabId = msg.sender?.tab?.id
    if (typeof tabId === "number") {
      return await getTranslationState(tabId)
    }
    logger.error("Invalid tabId in getEnablePageTranslationFromContentScript", msg)
    return false
  })

  onMessage("ensureIframeHostContentInjected", async (msg) => {
    const tabId = msg.data?.tabId ?? msg.sender?.tab?.id
    if (typeof tabId === "number") {
      await injectHostContentIntoTabIframes(tabId)
      return
    }

    logger.error("Invalid tabId in ensureIframeHostContentInjected", msg)
  })

  onMessage("injectCurrentIframesAfterTopFrameNodeTranslation", async (msg) => {
    const tabId = msg.sender?.tab?.id
    const frameId = msg.sender?.frameId

    if (typeof tabId === "number" && frameId === 0) {
      await injectHostContentIntoCurrentTabIframesAfterNodeTranslation(tabId)
      return
    }

    logger.error("Invalid sender in injectCurrentIframesAfterTopFrameNodeTranslation", msg)
  })

  onMessage("tryToSetEnablePageTranslationByTabId", async (msg) => {
    const { tabId, enabled, analyticsContext } = msg.data
    if (!enabled) {
      await setPageTranslationEnabled(tabId, false)
      notifyPageTranslationStateChanged(tabId, false)
    }
    requestManagerToTogglePageTranslation(tabId, enabled, analyticsContext)
  })

  onMessage("tryToSetEnablePageTranslationOnContentScript", async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { enabled, analyticsContext } = msg.data
    if (typeof tabId === "number") {
      logger.info("sending tryToSetEnablePageTranslationOnContentScript to manager", { enabled, tabId })
      if (!enabled) {
        await setPageTranslationEnabled(tabId, false)
        notifyPageTranslationStateChanged(tabId, false)
      }
      requestManagerToTogglePageTranslation(tabId, enabled, analyticsContext)
    }
    else {
      logger.error("tabId is not a number", msg)
    }
  })

  onMessage("checkAndAskAutoPageTranslation", async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { url, detectedCodeOrUnd } = msg.data
    if (typeof tabId === "number") {
      const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
      if (!config)
        return
      const shouldEnable = await shouldEnableAutoTranslation(url, detectedCodeOrUnd, config)
      if (shouldEnable) {
        requestManagerToTogglePageTranslation(
          tabId,
          true,
          createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.PAGE_AUTO),
        )
      }
    }
  })

  onMessage("setAndNotifyPageTranslationStateChangedByManager", async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { enabled } = msg.data
    if (typeof tabId === "number") {
      await setPageTranslationEnabled(tabId, enabled)
      notifyPageTranslationStateChanged(tabId, enabled)

      const senderFrameId = msg.sender?.frameId
      if (enabled && (senderFrameId === 0 || senderFrameId === undefined)) {
        void injectHostContentIntoTabIframes(tabId)
      }
    }
    else {
      logger.error("tabId is not a number", msg)
    }
  })

  // === Helper Functions ===
  async function getTranslationState(tabId: number): Promise<boolean> {
    return await getPageTranslationEnabled(tabId)
  }

  // === Cleanup ===
  browser.tabs.onRemoved.addListener(async (tabId) => {
    await storage.removeItem(getTranslationStateKey(tabId))
  })

  // Clear translation state when navigating to a new page in the same tab
  browser.webNavigation.onCommitted.addListener(async (details) => {
    // Only handle main frame navigations, not iframes
    if (details.frameId !== 0)
      return

    await storage.removeItem(getTranslationStateKey(details.tabId))
  })
}
