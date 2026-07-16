import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"
import { getTranslationStateKey } from "@/utils/constants/storage-keys"

const setIconMock = vi.fn<(...args: any[]) => any>()
const storageGetItemMock = vi.fn<(...args: any[]) => any>()
const storageOnChangedAddListenerMock = vi.fn<(...args: any[]) => any>()
const webNavigationOnCommittedAddListenerMock = vi.fn<(...args: any[]) => any>()

const DEFAULT_ACTION_ICON_PATHS = {
  16: "/icon/16.png",
  32: "/icon/32.png",
  48: "/icon/48.png",
}

const ACTIVE_ACTION_ICON_PATHS = {
  16: "/icon/16-active.png",
  32: "/icon/32-active.png",
  48: "/icon/48-active.png",
}

function getStorageChangeListener() {
  const listener = storageOnChangedAddListenerMock.mock.calls.at(-1)?.[0]
  if (!listener) {
    throw new Error("Expected storage.session.onChanged listener to be registered")
  }
  return listener as (changes: Record<string, { newValue?: unknown }>) => Promise<void>
}

function getOnCommittedListener() {
  const listener = webNavigationOnCommittedAddListenerMock.mock.calls.at(-1)?.[0]
  if (!listener) {
    throw new Error("Expected webNavigation.onCommitted listener to be registered")
  }
  return listener as (details: { tabId: number; frameId: number; url: string }) => Promise<void>
}

async function setupSubject() {
  const { registerActionIconListeners } = await import("../browser-action-icon")
  registerActionIconListeners()
}

describe("browser action icon", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    browser.action.setIcon = setIconMock
    browser.storage.session.onChanged.addListener = storageOnChangedAddListenerMock
    browser.webNavigation.onCommitted.addListener = webNavigationOnCommittedAddListenerMock
    storage.getItem = storageGetItemMock

    setIconMock.mockResolvedValue(undefined)
    storageGetItemMock.mockResolvedValue(undefined)
  })

  it("updates the tab icon when translation state changes", async () => {
    await setupSubject()

    await getStorageChangeListener()({
      "translationState.42": {
        newValue: { enabled: true, origin: "https://example.com" },
      },
    })

    expect(setIconMock).toHaveBeenCalledWith({
      tabId: 42,
      path: ACTIVE_ACTION_ICON_PATHS,
    })
  })

  it("restores the active icon after same-origin top-frame navigation", async () => {
    await setupSubject()
    storageGetItemMock.mockResolvedValue({
      enabled: true,
      origin: "https://example.com",
    })

    await getOnCommittedListener()({
      tabId: 42,
      frameId: 0,
      url: "https://example.com/articles/2?from=feed#comments",
    })

    expect(storageGetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42))
    expect(setIconMock).toHaveBeenCalledWith({
      tabId: 42,
      path: ACTIVE_ACTION_ICON_PATHS,
    })
  })

  it("uses the default icon after cross-origin top-frame navigation", async () => {
    await setupSubject()
    storageGetItemMock.mockResolvedValue({
      enabled: true,
      origin: "https://example.com",
    })

    await getOnCommittedListener()({
      tabId: 42,
      frameId: 0,
      url: "https://other.example.com/articles/2",
    })

    expect(setIconMock).toHaveBeenCalledWith({
      tabId: 42,
      path: DEFAULT_ACTION_ICON_PATHS,
    })
  })

  it.each([
    ["disabled", { enabled: false }],
    ["missing", undefined],
  ])("uses the default icon when translation state is %s", async (_label, state) => {
    await setupSubject()
    storageGetItemMock.mockResolvedValue(state)

    await getOnCommittedListener()({
      tabId: 42,
      frameId: 0,
      url: "https://example.com/articles/2",
    })

    expect(setIconMock).toHaveBeenCalledWith({
      tabId: 42,
      path: DEFAULT_ACTION_ICON_PATHS,
    })
  })

  it("ignores iframe navigation", async () => {
    await setupSubject()

    await getOnCommittedListener()({
      tabId: 42,
      frameId: 7,
      url: "https://embed.example.net/frame",
    })

    expect(storageGetItemMock).not.toHaveBeenCalled()
    expect(setIconMock).not.toHaveBeenCalled()
  })
})
