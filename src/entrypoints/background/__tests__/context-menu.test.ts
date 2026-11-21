import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"
import {
  MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX,
  MENU_ID_SELECTION_READ_ALOUD,
  MENU_ID_SELECTION_TRANSLATE,
  MENU_ID_TRANSLATE,
} from "@/utils/context-menu"
import { i18n } from "@/utils/i18n"
import { captureLogs, loggedError, logRecord } from "@/utils/logging/testing"
import { initializeContextMenu, registerContextMenuListeners } from "../context-menu"

// vi.mock factories run during the static imports above, before this module's
// own top-level code, so the mocks they return must be hoisted with them.
const { sendMessageMock, ensureInitializedConfigMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn<(...args: any[]) => any>(),
  ensureInitializedConfigMock: vi.fn<(...args: any[]) => any>(),
}))
const storageSetItemMock = vi.fn<(...args: any[]) => any>()
const contextMenuClickListeners: Array<(info: any, tab?: any) => Promise<void> | void> = []

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("../config", () => ({
  ensureInitializedConfig: ensureInitializedConfigMock,
}))

vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/env")>()
  return {
    env: { ...actual.env, WXT_OFFICIAL_SITE_ORIGINS: ["https://readfrog.app"] },
  }
})

function createConfig(enabled: boolean): Config {
  return {
    contextMenu: {
      enabled,
    },
    selectionToolbar: {
      builtInActions: {
        dictionary: {
          enabled: false,
          providerId: "read-frog-ai:gpt-6-luna",
        },
        sentenceAnalysis: {
          enabled: false,
          providerId: "read-frog-ai:gpt-6-luna",
        },
      },
      customActions: [],
    },
  } as unknown as Config
}

describe("background context menu", () => {
  beforeEach(() => {
    contextMenuClickListeners.length = 0
    vi.clearAllMocks()
    sendMessageMock.mockResolvedValue(undefined)

    browser.contextMenus.create = vi.fn<(...args: any[]) => any>()
    browser.contextMenus.removeAll = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
    browser.contextMenus.update = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
    browser.contextMenus.onClicked.addListener = vi.fn<(...args: any[]) => any>((listener) => {
      contextMenuClickListeners.push(listener as (info: any, tab?: any) => Promise<void> | void)
    })

    browser.tabs.query = vi.fn<(...args: any[]) => any>().mockResolvedValue([{ id: 1 }])
    browser.tabs.onActivated.addListener = vi.fn<(...args: any[]) => any>()
    browser.tabs.onUpdated.addListener = vi.fn<(...args: any[]) => any>()
    browser.storage.session.onChanged.addListener = vi.fn<(...args: any[]) => any>()

    storage.watch = vi.fn<(...args: any[]) => any>()
    storage.getItem = vi.fn<(...args: any[]) => any>().mockResolvedValue({ enabled: true })
    storage.setItem = storageSetItemMock
    storageSetItemMock.mockResolvedValue(undefined)

    i18n.t = vi.fn<(...args: any[]) => any>(
      (key: string) =>
        ({
          "contextMenu.translate": "Translate",
          "contextMenu.translateSelection": 'Translate "%s"',
          "contextMenu.readAloudSelection": 'Read aloud "%s"',
          "contextMenu.showOriginal": "Show Original",
          "options.selectionToolbar.customActions.templates.dictionary.name": "Dictionary",
          "options.selectionToolbar.customActions.templates.sentenceAnalysis.name":
            "Sentence Analysis",
        })[key] ?? key,
    ) as typeof i18n.t
  })

  it("creates page and selection menu items when the context menu is enabled", async () => {
    ensureInitializedConfigMock.mockResolvedValue(createConfig(true))

    await initializeContextMenu()

    expect(browser.contextMenus.removeAll).toHaveBeenCalledOnce()
    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(1, {
      id: MENU_ID_TRANSLATE,
      title: "Translate",
      contexts: ["page"],
    })
    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(2, {
      id: MENU_ID_SELECTION_TRANSLATE,
      title: 'Translate "%s"',
      contexts: ["selection"],
    })
    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(3, {
      id: MENU_ID_SELECTION_READ_ALOUD,
      title: 'Read aloud "%s"',
      contexts: ["selection"],
    })
    expect(browser.contextMenus.update).toHaveBeenCalledWith(MENU_ID_TRANSLATE, {
      title: "Show Original",
    })
  })

  it("creates custom action items inline for enabled custom actions", async () => {
    const config = createConfig(true)
    config.selectionToolbar.customActions = [
      { id: "dictionary", name: "Dictionary", enabled: true },
      { id: "disabled", name: "Disabled", enabled: false },
      { id: "rewrite", name: "Rewrite", enabled: true },
    ] as Config["selectionToolbar"]["customActions"]
    ensureInitializedConfigMock.mockResolvedValue(config)

    await initializeContextMenu()

    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(4, {
      id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}dictionary`,
      title: "Dictionary",
      contexts: ["selection"],
    })
    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(5, {
      id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}rewrite`,
      title: "Rewrite",
      contexts: ["selection"],
    })
  })

  it("creates the built-in Dictionary item when it is enabled", async () => {
    const config = createConfig(true)
    config.selectionToolbar.builtInActions.dictionary.enabled = true
    ensureInitializedConfigMock.mockResolvedValue(config)

    await initializeContextMenu()

    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(4, {
      id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}default-dictionary`,
      title: "Dictionary",
      contexts: ["selection"],
    })
  })

  it("creates the built-in Sentence Analysis item after the Dictionary's", async () => {
    const config = createConfig(true)
    config.selectionToolbar.builtInActions.dictionary.enabled = true
    config.selectionToolbar.builtInActions.sentenceAnalysis.enabled = true
    ensureInitializedConfigMock.mockResolvedValue(config)

    await initializeContextMenu()

    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(5, {
      id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}default-sentence-analysis`,
      title: "Sentence Analysis",
      contexts: ["selection"],
    })
  })

  it("removes menu items without recreating them when the context menu is disabled", async () => {
    ensureInitializedConfigMock.mockResolvedValue(createConfig(false))

    await initializeContextMenu()

    expect(browser.contextMenus.removeAll).toHaveBeenCalledOnce()
    expect(browser.contextMenus.create).not.toHaveBeenCalled()
    expect(browser.contextMenus.update).not.toHaveBeenCalled()
  })

  it("waits until the background is ready before rebuilding the menu on a config change", async () => {
    let configWatcher: ((config: Config) => Promise<void>) | undefined
    storage.watch = vi.fn<(...args: any[]) => any>((_key, callback) => {
      configWatcher = callback
    })
    const { promise: ready, resolve: markReady } = Promise.withResolvers<void>()
    registerContextMenuListeners(() => ready)
    if (!configWatcher) {
      throw new Error("Config watcher was not registered")
    }

    const rebuilt = configWatcher(createConfig(true))
    await Promise.resolve()
    expect(browser.contextMenus.removeAll).not.toHaveBeenCalled()

    markReady()
    await rebuilt
    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: MENU_ID_TRANSLATE,
      title: "Translate",
      contexts: ["page"],
    })
  })

  it("records a scoped user refusal when the translate menu disables translation", async () => {
    registerContextMenuListeners(async () => {})

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    // storage.getItem defaults to { enabled: true }, so this click toggles off.
    await clickHandler(
      { menuItemId: MENU_ID_TRANSLATE },
      { id: 5, url: "https://example.com/articles/1" },
    )

    expect(storageSetItemMock).toHaveBeenCalledWith("session:translationState.5", {
      enabled: false,
      userDisabled: true,
      origin: "https://example.com",
    })
  })

  it("routes selection menu clicks to the matching tab and frame", async () => {
    registerContextMenuListeners(async () => {})

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    await clickHandler(
      {
        menuItemId: MENU_ID_SELECTION_TRANSLATE,
        selectionText: "Selected text",
        frameId: 7,
      },
      {
        id: 5,
      },
    )

    expect(sendMessageMock).toHaveBeenCalledWith(
      "openSelectionTranslationFromContextMenu",
      { selectionText: "Selected text" },
      { tabId: 5, frameId: 7 },
    )
  })

  it("routes read aloud menu clicks to the matching tab and frame", async () => {
    registerContextMenuListeners(async () => {})

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    await clickHandler(
      {
        menuItemId: MENU_ID_SELECTION_READ_ALOUD,
        selectionText: "Selected text",
        frameId: 4,
      },
      {
        id: 2,
      },
    )

    expect(sendMessageMock).toHaveBeenCalledWith(
      "readAloudSelectionFromContextMenu",
      { selectionText: "Selected text" },
      { tabId: 2, frameId: 4 },
    )
  })

  it("routes custom action menu clicks to the matching tab and frame", async () => {
    registerContextMenuListeners(async () => {})

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    await clickHandler(
      {
        menuItemId: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}dictionary`,
        selectionText: "Selected text",
        frameId: 7,
      },
      {
        id: 5,
      },
    )

    expect(sendMessageMock).toHaveBeenCalledWith(
      "openSelectionCustomActionFromContextMenu",
      { actionId: "dictionary", selectionText: "Selected text" },
      { tabId: 5, frameId: 7 },
    )
  })

  it.each([
    [MENU_ID_SELECTION_TRANSLATE, "openSelectionTranslationFromContextMenu"],
    [MENU_ID_SELECTION_READ_ALOUD, "readAloudSelectionFromContextMenu"],
    [
      `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}dictionary`,
      "openSelectionCustomActionFromContextMenu",
    ],
  ])(
    "routes %s clicks in an ebook reader book section to the top frame",
    async (menuItemId, messageType) => {
      registerContextMenuListeners(async () => {})

      const clickHandler = contextMenuClickListeners[0]
      if (!clickHandler) {
        throw new Error("Context menu click listener was not registered")
      }

      // The reader relays the section's selections to the top frame's toolbar,
      // and the top frame is told so: it never saw this right-click.
      await clickHandler(
        {
          menuItemId,
          selectionText: "punched",
          frameId: 7,
          frameUrl: "blob:https://readfrog.app/0f8e0c55-3c3c-4a6c-9a51-7d5a3b0b6c11",
          pageUrl: "https://readfrog.app/ebooks/book-1",
        },
        { id: 5 },
      )

      expect(sendMessageMock).toHaveBeenCalledWith(
        messageType,
        expect.objectContaining({ selectionText: "punched", fromEbookSection: true }),
        { tabId: 5, frameId: 0 },
      )
    },
  )

  it("keeps selection menu clicks in another site's blob: frame in that frame", async () => {
    registerContextMenuListeners(async () => {})

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    await clickHandler(
      {
        menuItemId: MENU_ID_SELECTION_TRANSLATE,
        selectionText: "Selected text",
        frameId: 7,
        frameUrl: "blob:https://example.com/0f8e0c55-3c3c-4a6c-9a51-7d5a3b0b6c11",
      },
      { id: 5 },
    )

    expect(sendMessageMock).toHaveBeenCalledWith(
      "openSelectionTranslationFromContextMenu",
      { selectionText: "Selected text" },
      { tabId: 5, frameId: 7 },
    )
  })

  it("logs a warning when the clicked tab has no content script to receive the action", async () => {
    const noReceiver = new Error("Could not establish connection. Receiving end does not exist.")
    sendMessageMock.mockRejectedValue(noReceiver)
    const logs = captureLogs()
    registerContextMenuListeners(async () => {})

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    const tab = { id: 5, url: "chrome://version/" }
    // storage.getItem defaults to { enabled: true }, so this click toggles off
    // and sends both the state change and the toggle request.
    await clickHandler({ menuItemId: MENU_ID_TRANSLATE }, tab)
    await clickHandler({ menuItemId: MENU_ID_SELECTION_TRANSLATE, selectionText: "Text" }, tab)
    await clickHandler({ menuItemId: MENU_ID_SELECTION_READ_ALOUD, selectionText: "Text" }, tab)
    await clickHandler(
      { menuItemId: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}action-1`, selectionText: "Text" },
      tab,
    )
    // The sends are not awaited, so let their rejections reach the handlers.
    await Promise.resolve()

    expect(sendMessageMock).toHaveBeenCalledTimes(5)
    expect(logs).toHaveLength(5)
    expect(logs).toContainEqual(
      logRecord("warn", "Failed to deliver context menu action to the tab", {
        error: loggedError(noReceiver.message),
      }),
    )
  })
})
