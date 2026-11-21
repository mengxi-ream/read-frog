import type { Browser } from "#imports"
import type { Config } from "@/types/config/config"
import { browser, storage } from "#imports"
import { env } from "@/env"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import {
  getTranslationStateKey,
  parseTabIdFromStorageKey,
  TRANSLATION_STATE_KEY_PREFIX,
} from "@/utils/constants/storage-keys"
import {
  getSelectionContextMenuItems,
  MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX,
  MENU_ID_SELECTION_READ_ALOUD,
  MENU_ID_SELECTION_TRANSLATE,
  MENU_ID_TRANSLATE,
} from "@/utils/context-menu"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"
import { ensureInitializedConfig } from "./config"
import { getPageTranslationEnabled, setPageTranslationEnabled } from "./page-translation-state"

const log = createLogger("background/context-menu")

/**
 * Register all context menu event listeners synchronously
 * This must be called during main() execution to ensure listeners are registered
 * before Chrome completes initialization
 */
export function registerContextMenuListeners(waitUntilReady: () => Promise<void>) {
  // Listen for config changes to update context menu
  storage.watch<Config>(`local:${CONFIG_STORAGE_KEY}`, async (newConfig) => {
    if (newConfig) {
      // On first start after an update, config migration writes the config before
      // i18n is initialized; Chrome rejects a menu item with title "".
      await waitUntilReady()
      await updateContextMenuItems(newConfig)
    }
  })

  // Listen for tab activation to update menu title
  browser.tabs.onActivated.addListener(async (activeInfo) => {
    await updateTranslateMenuTitle(activeInfo.tabId)
  })

  // Listen for tab updates (e.g., navigation)
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      await updateTranslateMenuTitle(tabId)
    }
  })

  // Listen for translation state changes in storage
  // This ensures menu updates when translation is toggled from any UI
  // (floating button, auto-translate, etc.) without interfering with
  // the translation logic in translation-signal.ts
  browser.storage.session.onChanged.addListener(async (changes) => {
    for (const [key, change] of Object.entries(changes)) {
      // Check if this is a translation state change
      if (key.startsWith(TRANSLATION_STATE_KEY_PREFIX.replace("session:", ""))) {
        const tabId = parseTabIdFromStorageKey(key)

        if (!Number.isNaN(tabId)) {
          // Only update menu if this is the active tab
          const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
          if (activeTab?.id === tabId) {
            const newValue = change.newValue as { enabled: boolean } | undefined
            await updateTranslateMenuTitle(tabId, newValue?.enabled)
          }
        }
      }
    }
  })

  // Handle menu item clicks
  browser.contextMenus.onClicked.addListener(handleContextMenuClick)
}

/**
 * Initialize context menu items based on config
 * This can be called asynchronously after listeners are registered
 */
export async function initializeContextMenu() {
  // Ensure config is initialized before setting up context menu
  const config = await ensureInitializedConfig()
  if (!config) {
    return
  }

  await updateContextMenuItems(config)
}

/**
 * Update context menu items based on config
 */
async function updateContextMenuItems(config: Config) {
  // Remove all existing menu items first
  await browser.contextMenus.removeAll()

  if (config.contextMenu.enabled) {
    browser.contextMenus.create({
      id: MENU_ID_TRANSLATE,
      title: i18n.t("contextMenu.translate"),
      contexts: ["page"],
    })

    for (const item of getSelectionContextMenuItems(config.selectionToolbar)) {
      browser.contextMenus.create({ ...item, contexts: ["selection"] })
    }
  }

  // Update translate menu title for current tab
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.id) {
    await updateTranslateMenuTitle(activeTab.id)
  }
}

/**
 * Update translate menu title based on current translation state
 * @param tabId - The tab ID to check translation state for
 * @param enabled - Optional: if provided, use this value instead of reading from storage
 */
async function updateTranslateMenuTitle(tabId: number, enabled?: boolean) {
  const config = await ensureInitializedConfig()
  if (!config?.contextMenu.enabled) {
    return
  }

  try {
    let isTranslated: boolean
    if (enabled !== undefined) {
      isTranslated = enabled
    } else {
      const state = await storage.getItem<{ enabled: boolean }>(getTranslationStateKey(tabId))
      isTranslated = state?.enabled ?? false
    }

    await browser.contextMenus.update(MENU_ID_TRANSLATE, {
      title: isTranslated ? i18n.t("contextMenu.showOriginal") : i18n.t("contextMenu.translate"),
    })
  } catch {
    // Menu item might not exist if translateEnabled is false
  }
}

/**
 * Handle context menu item click
 */
async function handleContextMenuClick(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab,
) {
  if (!tab?.id) {
    return
  }

  if (info.menuItemId === MENU_ID_TRANSLATE) {
    await handleTranslateClick(tab.id, tab.url)
    return
  }

  if (info.menuItemId === MENU_ID_SELECTION_TRANSLATE) {
    await handleSelectionTranslateClick(info, tab.id)
    return
  }

  if (info.menuItemId === MENU_ID_SELECTION_READ_ALOUD) {
    await handleSelectionReadAloudClick(info, tab.id)
    return
  }

  if (
    typeof info.menuItemId === "string" &&
    info.menuItemId.startsWith(MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX)
  ) {
    const actionId = info.menuItemId.slice(MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX.length)
    if (!actionId) {
      return
    }

    await handleSelectionCustomActionClick(info, tab.id, actionId)
  }
}

/**
 * A menu click can land on a tab with no content script to receive it: a
 * browser page, the Web Store, or a tab left open across an extension update.
 */
function warnMenuActionNotDelivered(error: unknown) {
  log.warn("Failed to deliver context menu action to the tab", { error })
}

/**
 * Whether the menu was opened in a book section of the readfrog.app ebook
 * reader: a blob: frame the site made (see isReadFrogEbookSection). Only its
 * URL is known here.
 */
function isReadFrogEbookSectionFrame(frameUrl: string | undefined) {
  if (!frameUrl?.startsWith("blob:")) {
    return false
  }

  try {
    return env.WXT_OFFICIAL_SITE_ORIGINS.includes(new URL(frameUrl).origin)
  } catch {
    return false
  }
}

/**
 * A selection action goes to the frame the menu was opened in, whose toolbar
 * holds the selection. A book section has no toolbar: the reader relays its
 * selections to the top frame's, so the action goes there, marked as coming
 * from the book. The top frame never saw that right-click, so it acts on the
 * relayed selection, not on its own.
 */
function getSelectionActionDelivery(
  info: Browser.contextMenus.OnClickData,
  tabId: number,
  selectionText: string,
) {
  if (typeof info.frameId !== "number") {
    return { target: tabId, data: { selectionText } }
  }

  if (isReadFrogEbookSectionFrame(info.frameUrl)) {
    return { target: { tabId, frameId: 0 }, data: { selectionText, fromEbookSection: true } }
  }

  return { target: { tabId, frameId: info.frameId }, data: { selectionText } }
}

/**
 * Handle translate menu click - toggle page translation
 */
async function handleTranslateClick(tabId: number, tabUrl?: string) {
  const isCurrentlyTranslated = await getPageTranslationEnabled(tabId)
  const newState = !isCurrentlyTranslated

  if (!newState) {
    await setPageTranslationEnabled(tabId, false, tabUrl, true)
    void sendMessage("notifyTranslationStateChanged", { enabled: false }, tabId).catch(
      warnMenuActionNotDelivered,
    )
  }

  // Notify content script in that specific tab
  void sendMessage(
    "askManagerToTogglePageTranslation",
    {
      enabled: newState,
      analyticsContext: newState
        ? createFeatureUsageContext(
            ANALYTICS_FEATURE.PAGE_TRANSLATION,
            ANALYTICS_SURFACE.CONTEXT_MENU,
          )
        : undefined,
    },
    tabId,
  ).catch(warnMenuActionNotDelivered)

  // Update menu title immediately
  await updateTranslateMenuTitle(tabId, newState)
}

async function handleSelectionTranslateClick(
  info: Browser.contextMenus.OnClickData,
  tabId: number,
) {
  const selectionText = info.selectionText?.trim()
  if (!selectionText) {
    return
  }

  const { target, data } = getSelectionActionDelivery(info, tabId, selectionText)

  void sendMessage("openSelectionTranslationFromContextMenu", data, target).catch(
    warnMenuActionNotDelivered,
  )
}

async function handleSelectionReadAloudClick(
  info: Browser.contextMenus.OnClickData,
  tabId: number,
) {
  const selectionText = info.selectionText?.trim()
  if (!selectionText) {
    return
  }

  const { target, data } = getSelectionActionDelivery(info, tabId, selectionText)

  void sendMessage("readAloudSelectionFromContextMenu", data, target).catch(
    warnMenuActionNotDelivered,
  )
}

async function handleSelectionCustomActionClick(
  info: Browser.contextMenus.OnClickData,
  tabId: number,
  actionId: string,
) {
  const selectionText = info.selectionText?.trim()
  if (!selectionText) {
    return
  }

  const { target, data } = getSelectionActionDelivery(info, tabId, selectionText)

  void sendMessage("openSelectionCustomActionFromContextMenu", { actionId, ...data }, target).catch(
    warnMenuActionNotDelivered,
  )
}
