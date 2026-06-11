import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { FeatureUsageContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import { browser, storage } from "#imports"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { normalizeDetectedCode } from "@/utils/config/languages"
import { CONFIG_STORAGE_KEY, DEFAULT_DETECTED_CODE } from "@/utils/constants/config"
import { getDetectedCodeStateKey, getTranslationStateKey } from "@/utils/constants/storage-keys"
import { shouldEnableAutoTranslation } from "@/utils/host/translate/auto-translation"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { injectHostContentIntoCurrentTabIframesAfterNodeTranslation, injectHostContentIntoTabIframes } from "./iframe-injection"
import {
  getPageTranslationEnabled,
  getPageTranslationState,
  isPageTranslationStateInUrlScope,
  setPageTranslationEnabled,
} from "./page-translation-state"

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

function isIframe(frameId: number | undefined): boolean {
  return frameId !== undefined && frameId !== 0
}

async function getDetectedCodeForTab(tabId: number): Promise<LangCodeISO6393> {
  const storedCode = await storage.getItem<unknown>(getDetectedCodeStateKey(tabId))
  return normalizeDetectedCode(storedCode)
}

function notifyDetectedCodeChanged(detectedCode: LangCodeISO6393) {
  void sendMessage("detectedPageLanguageChanged", { detectedCode })
    // The popup is often closed, so having no receiver is expected.
    .catch(() => {})
}

async function isActiveCurrentWindowTab(tabId: number): Promise<boolean> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
  return activeTab?.id === tabId
}

async function publishCachedDetectedCodeForTab(tabId: number): Promise<void> {
  notifyDetectedCodeChanged(await getDetectedCodeForTab(tabId))
}

function requestDetectedPageLanguageRefresh(tabId: number) {
  void sendMessage("refreshDetectedPageLanguage", undefined, tabId)
    .catch(error => logger.warn("Failed to refresh detected page language", error))
}

async function publishAndRefreshActiveTab(tabId: number): Promise<void> {
  await publishCachedDetectedCodeForTab(tabId)
  requestDetectedPageLanguageRefresh(tabId)
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

  onMessage("reportDetectedPageLanguage", async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { url, detectedCodeOrUnd } = msg.data
    if (typeof tabId === "number") {
      const detectedCode = normalizeDetectedCode(detectedCodeOrUnd)
      await storage.setItem<LangCodeISO6393>(getDetectedCodeStateKey(tabId), detectedCode)

      if (await isActiveCurrentWindowTab(tabId)) {
        notifyDetectedCodeChanged(detectedCode)
      }

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
      return
    }

    logger.error("Invalid tabId in reportDetectedPageLanguage", msg)
  })

  onMessage("getDetectedCode", async (msg) => {
    const tabId = msg.sender?.tab?.id
    if (typeof tabId === "number") {
      return await getDetectedCodeForTab(tabId)
    }

    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (typeof activeTab?.id === "number") {
      return await getDetectedCodeForTab(activeTab.id)
    }

    return DEFAULT_DETECTED_CODE
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

  onMessage("setAndNotifyPageTranslationStateChangedByManager", async (msg) => {
    const tabId = msg.sender?.tab?.id
    const { enabled, url } = msg.data
    if (typeof tabId === "number") {
      const senderFrameId = msg.sender?.frameId

      if (enabled && isIframe(senderFrameId)) {
        // Iframe enabled echoes only synchronize UI; they must not write
        // tab-level state because that state is scoped to the top-frame origin.
        const currentState = await getPageTranslationState(tabId)
        if (!currentState?.enabled)
          return

        notifyPageTranslationStateChanged(tabId, true)
        return
      }

      await setPageTranslationEnabled(tabId, enabled, url ?? msg.sender?.tab?.url)
      notifyPageTranslationStateChanged(tabId, enabled)

      if (enabled && !isIframe(senderFrameId)) {
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
    await storage.removeItem(getDetectedCodeStateKey(tabId))
  })

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    await publishAndRefreshActiveTab(activeInfo.tabId)
  })

  // Clear translation state only when the tab leaves the origin where it was enabled.
  browser.webNavigation.onCommitted.addListener(async (details) => {
    // Only handle main frame navigations, not iframes
    if (details.frameId !== 0)
      return

    const state = await getPageTranslationState(details.tabId)
    if (!state?.enabled)
      return

    if (isPageTranslationStateInUrlScope(state, details.url))
      return

    await storage.removeItem(getTranslationStateKey(details.tabId))
  })
}
