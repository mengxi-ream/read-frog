import type { Config } from "@/types/config/config"
import { browser, storage } from "#imports"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY } from "@/utils/constants/translate"
import { isPageTranslationShortcutEmpty, isValidConfiguredPageTranslationShortcut } from "@/utils/page-translation-shortcut"

export const FIREFOX_SIDEBAR_COMMAND_NAME = "_execute_sidebar_action"

interface CommandsApi {
  update?: (details: { name: string, shortcut?: string }) => Promise<void> | void
}

interface FirefoxSidebarShortcutBrowser {
  commands?: CommandsApi
}

type ConfigStorageKey = `local:${string}`

interface SidebarShortcutStorage {
  getItem: (key: ConfigStorageKey) => Promise<Config | null>
  watch: (key: ConfigStorageKey, callback: (newValue: Config | null) => void) => void
}

interface SidebarShortcutLogger {
  warn: (...args: any[]) => void
}

const COMMAND_MODIFIER_MAP: Record<string, string> = {
  Alt: "Alt",
  Command: "Command",
  Control: "Ctrl",
  Ctrl: "Ctrl",
  MacCtrl: "MacCtrl",
  Meta: "Command",
  Mod: "Ctrl",
  Shift: "Shift",
}

function normalizeCommandKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key
}

export function normalizeFirefoxCommandShortcut(shortcut: string | null | undefined): string | null {
  if (isPageTranslationShortcutEmpty(shortcut)) {
    return ""
  }

  const configuredShortcut = shortcut ?? ""
  if (!isValidConfiguredPageTranslationShortcut(configuredShortcut)) {
    return null
  }

  const parts = configuredShortcut.split("+").map(part => part.trim()).filter(Boolean)
  const key = parts.at(-1)
  if (!key) {
    return null
  }

  const modifiers = parts.slice(0, -1).map(part => COMMAND_MODIFIER_MAP[part] ?? part)
  return [...modifiers, normalizeCommandKey(key)].join("+")
}

export function getFirefoxSidebarCommandShortcut(config: Config | null | undefined): string | null {
  const translateConfig = (config ?? DEFAULT_CONFIG).translate
  if (translateConfig.page.splitPanelMode !== "sideAPI") {
    return ""
  }

  return normalizeFirefoxCommandShortcut(
    translateConfig.page.sidePanelShortcut ?? DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY,
  )
}

export async function updateFirefoxSidebarCommandShortcut({
  commandShortcut,
  extensionBrowser,
  logger,
}: {
  commandShortcut: string | null
  extensionBrowser: FirefoxSidebarShortcutBrowser
  logger: SidebarShortcutLogger
}) {
  try {
    if (commandShortcut === null) {
      logger.warn("Skipping invalid Firefox sidebar shortcut")
      return
    }

    const commands = extensionBrowser.commands
    if (typeof commands?.update !== "function") {
      return
    }

    await commands.update({
      name: FIREFOX_SIDEBAR_COMMAND_NAME,
      shortcut: commandShortcut,
    })
  }
  catch (error) {
    logger.warn("Failed to update Firefox sidebar shortcut", error)
  }
}

export function setupFirefoxSidebarShortcutSync({
  extensionBrowser,
  extensionStorage,
  isFirefox = import.meta.env.FIREFOX,
  logger,
}: {
  extensionBrowser?: FirefoxSidebarShortcutBrowser
  extensionStorage?: SidebarShortcutStorage
  isFirefox?: boolean
  logger: SidebarShortcutLogger
}) {
  if (!isFirefox) {
    return
  }

  const activeBrowser = extensionBrowser ?? (browser as unknown as FirefoxSidebarShortcutBrowser)
  const activeStorage = extensionStorage ?? {
    getItem: (key: ConfigStorageKey) => storage.getItem<Config>(key),
    watch: (key: ConfigStorageKey, callback: (newValue: Config | null) => void) => {
      storage.watch<Config>(key, callback)
    },
  }

  const syncShortcut = (config: Config | null | undefined) => {
    void updateFirefoxSidebarCommandShortcut({
      commandShortcut: getFirefoxSidebarCommandShortcut(config),
      extensionBrowser: activeBrowser,
      logger,
    })
  }

  void activeStorage
    .getItem(`local:${CONFIG_STORAGE_KEY}`)
    .then(syncShortcut)
    .catch(error => logger.warn("Failed to read config for Firefox sidebar shortcut sync", error))

  try {
    activeStorage.watch(`local:${CONFIG_STORAGE_KEY}`, syncShortcut)
  }
  catch (error) {
    logger.warn("Failed to watch config for Firefox sidebar shortcut sync", error)
  }
}
