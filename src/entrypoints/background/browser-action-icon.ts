import { browser } from "#imports"
import { translationStateSchema } from "@/types/translation-state"
import { parseTabIdFromStorageKey, TRANSLATION_STATE_KEY_PREFIX } from "@/utils/constants/storage-keys"
import { logger } from "@/utils/logger"
import { getPageTranslationEnabled } from "./page-translation-state"

type ActionIconSize = 16 | 32 | 48
type ActionIconPathMap = Record<ActionIconSize, string>

const DEFAULT_ACTION_ICON_PATHS: ActionIconPathMap = {
  16: "/icon/16.png",
  32: "/icon/32.png",
  48: "/icon/48.png",
}

const ACTIVE_ACTION_ICON_PATHS: ActionIconPathMap = {
  16: "/icon/16-active.png",
  32: "/icon/32-active.png",
  48: "/icon/48-active.png",
}

async function updateActionIconForPageTranslation(tabId: number, enabled: boolean) {
  await browser.action.setIcon({
    tabId,
    path: enabled ? ACTIVE_ACTION_ICON_PATHS : DEFAULT_ACTION_ICON_PATHS,
  })
}

export function registerActionIconListeners() {
  browser.storage.session.onChanged.addListener(async (changes) => {
    await Promise.allSettled(
      Object.entries(changes).map(async ([storageKey, change]) => {
        if (!storageKey.startsWith(TRANSLATION_STATE_KEY_PREFIX.replace("session:", ""))) {
          return
        }

        const tabId = parseTabIdFromStorageKey(storageKey)
        if (Number.isNaN(tabId)) {
          return
        }

        const parsed = translationStateSchema.safeParse(change.newValue)
        const enabled = parsed.success ? parsed.data.enabled : false
        await updateActionIconForPageTranslation(tabId, enabled)
      }),
    )
  })
}

export async function initializeActionIcons() {
  const tabs = await browser.tabs.query({})

  await Promise.all(
    tabs.map(async (tab) => {
      if (typeof tab.id !== "number") {
        return
      }

      try {
        await updateActionIconForPageTranslation(tab.id, await getPageTranslationEnabled(tab.id))
      }
      catch (error) {
        logger.warn("Failed to initialize action icon for tab", { error, tabId: tab.id })
      }
    }),
  )
}
