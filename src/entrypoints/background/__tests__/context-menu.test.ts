import type { Config } from "@/types/config/config"
import { browser, i18n, storage } from "#imports"
import { beforeEach, describe, expect, it, vi } from "vitest"

const sendMessageMock = vi.fn()
const ensureInitializedConfigMock = vi.fn()
const contextMenuClickListeners: Array<(info: any, tab?: any) => Promise<void> | void> = []

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("../config", () => ({
  ensureInitializedConfig: ensureInitializedConfigMock,
}))

function createConfig(enabled: boolean): Config {
  return ({
    contextMenu: {
      enabled,
    },
    selectionToolbar: {
      customActions: [],
    },
  } as unknown) as Config
}

describe("background context menu", () => {
  beforeEach(() => {
    contextMenuClickListeners.length = 0
    vi.clearAllMocks()

    browser.contextMenus.create = vi.fn()
    browser.contextMenus.removeAll = vi.fn().mockResolvedValue(undefined)
    browser.contextMenus.update = vi.fn().mockResolvedValue(undefined)
    browser.contextMenus.onClicked.addListener = vi.fn((listener) => {
      contextMenuClickListeners.push(listener as (info: any, tab?: any) => Promise<void> | void)
    })

    browser.tabs.query = vi.fn().mockResolvedValue([{ id: 1 }])
    browser.tabs.onActivated.addListener = vi.fn()
    browser.tabs.onUpdated.addListener = vi.fn()
    browser.storage.session.onChanged.addListener = vi.fn()

    storage.watch = vi.fn()
    storage.getItem = vi.fn().mockResolvedValue({ enabled: true })
    storage.setItem = vi.fn().mockResolvedValue(undefined)

    i18n.t = vi.fn((key: string) => ({
      "contextMenu.translate": "Translate",
      "contextMenu.translateSelection": "Translate \"%s\"",
      "contextMenu.showOriginal": "Show Original",
    })[key] ?? key) as typeof i18n.t
  })

  it("creates page and selection menu items when the context menu is enabled", async () => {
    ensureInitializedConfigMock.mockResolvedValue(createConfig(true))

    const { initializeContextMenu, MENU_ID_SELECTION_TRANSLATE, MENU_ID_TRANSLATE } = await import("../context-menu")

    await initializeContextMenu()

    expect(browser.contextMenus.removeAll).toHaveBeenCalledOnce()
    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(1, {
      id: MENU_ID_TRANSLATE,
      title: "Translate",
      contexts: ["page"],
    })
    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(2, {
      id: MENU_ID_SELECTION_TRANSLATE,
      title: "Translate \"%s\"",
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

    const {
      initializeContextMenu,
      MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX,
    } = await import("../context-menu")

    await initializeContextMenu()

    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(3, {
      id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}dictionary`,
      title: "Dictionary",
      contexts: ["selection"],
    })
    expect(browser.contextMenus.create).toHaveBeenNthCalledWith(4, {
      id: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}rewrite`,
      title: "Rewrite",
      contexts: ["selection"],
    })
  })

  it("removes menu items without recreating them when the context menu is disabled", async () => {
    ensureInitializedConfigMock.mockResolvedValue(createConfig(false))

    const { initializeContextMenu } = await import("../context-menu")

    await initializeContextMenu()

    expect(browser.contextMenus.removeAll).toHaveBeenCalledOnce()
    expect(browser.contextMenus.create).not.toHaveBeenCalled()
    expect(browser.contextMenus.update).not.toHaveBeenCalled()
  })

  it("routes selection menu clicks to the matching tab and frame", async () => {
    const { MENU_ID_SELECTION_TRANSLATE, registerContextMenuListeners } = await import("../context-menu")

    registerContextMenuListeners()

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    await clickHandler({
      menuItemId: MENU_ID_SELECTION_TRANSLATE,
      selectionText: "Selected text",
      frameId: 7,
    }, {
      id: 5,
    })

    expect(sendMessageMock).toHaveBeenCalledWith(
      "openSelectionTranslationFromContextMenu",
      { selectionText: "Selected text" },
      { tabId: 5, frameId: 7 },
    )
  })

  it("routes custom action menu clicks to the matching tab and frame", async () => {
    const {
      MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX,
      registerContextMenuListeners,
    } = await import("../context-menu")

    registerContextMenuListeners()

    const clickHandler = contextMenuClickListeners[0]
    if (!clickHandler) {
      throw new Error("Context menu click listener was not registered")
    }

    await clickHandler({
      menuItemId: `${MENU_ID_SELECTION_CUSTOM_ACTION_PREFIX}dictionary`,
      selectionText: "Selected text",
      frameId: 7,
    }, {
      id: 5,
    })

    expect(sendMessageMock).toHaveBeenCalledWith(
      "openSelectionCustomActionFromContextMenu",
      { actionId: "dictionary", selectionText: "Selected text" },
      { tabId: 5, frameId: 7 },
    )
  })
})
