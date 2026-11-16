import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { browser } from "#imports"
import { getSelectionToolbarHiddenKey } from "@/utils/constants/storage-keys"

const { onMessageMock, sendMessageMock } = vi.hoisted(() => ({
  onMessageMock: vi.fn<(...args: any[]) => any>(),
  sendMessageMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({ onMessage: onMessageMock, sendMessage: sendMessageMock }))

const tabsOnRemovedAddListenerMock = vi.fn<(...args: any[]) => any>()
const webNavigationOnCommittedAddListenerMock = vi.fn<(...args: any[]) => any>()

type Sender = { tab?: { id?: number }; documentLifecycle?: string }

async function setupSubject() {
  const { setupSelectionToolbarHiddenUntilReload, isSelectionToolbarHiddenInTab } =
    await import("../selection-toolbar-hidden")
  setupSelectionToolbarHiddenUntilReload()

  const handler = (type: string) =>
    onMessageMock.mock.calls.find(([name]) => name === type)![1] as (message: {
      sender: Sender
    }) => Promise<unknown>

  return {
    isHiddenInTab: isSelectionToolbarHiddenInTab,
    hide: handler("hideSelectionToolbarUntilReload"),
    isHidden: handler("isSelectionToolbarHiddenUntilReload"),
    onRemoved: tabsOnRemovedAddListenerMock.mock.calls.at(-1)![0] as (tabId: number) => void,
    onCommitted: webNavigationOnCommittedAddListenerMock.mock.calls.at(-1)![0] as (details: {
      tabId: number
      frameId: number
    }) => void,
  }
}

// Removal is fire-and-forget in the listeners.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("setupSelectionToolbarHiddenUntilReload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeBrowser.reset()
    browser.tabs.onRemoved.addListener = tabsOnRemovedAddListenerMock
    browser.webNavigation.onCommitted.addListener = webNavigationOnCommittedAddListenerMock
    sendMessageMock.mockResolvedValue(undefined)
  })

  it("keeps the hide for the sender's tab and tells all of its frames", async () => {
    const { hide, isHidden, isHiddenInTab } = await setupSubject()

    expect(await isHidden({ sender: { tab: { id: 7 } } })).toBe(false)
    await hide({ sender: { tab: { id: 7 } } })

    expect(sendMessageMock).toHaveBeenCalledWith("selectionToolbarHiddenUntilReload", undefined, 7)
    expect(await isHidden({ sender: { tab: { id: 7 } } })).toBe(true)
    expect(await isHiddenInTab(7)).toBe(true)
    // Other tabs keep their toolbar.
    expect(await isHidden({ sender: { tab: { id: 8 } } })).toBe(false)
  })

  it("does not hide the toolbar of the next page Chrome prerenders in the tab", async () => {
    const { hide, isHidden } = await setupSubject()
    await hide({ sender: { tab: { id: 7 } } })

    expect(await isHidden({ sender: { tab: { id: 7 }, documentLifecycle: "prerender" } })).toBe(
      false,
    )
    expect(await isHidden({ sender: { tab: { id: 7 }, documentLifecycle: "active" } })).toBe(true)
  })

  it("ignores senders outside a tab", async () => {
    const { hide, isHidden } = await setupSubject()

    await hide({ sender: {} })

    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(await isHidden({ sender: {} })).toBe(false)
  })

  it("survives a tab with no receiver", async () => {
    const { hide, isHiddenInTab } = await setupSubject()
    sendMessageMock.mockRejectedValue(new Error("Could not establish connection"))

    await hide({ sender: { tab: { id: 7 } } })
    await settle()

    expect(await isHiddenInTab(7)).toBe(true)
  })

  it("clears on the top frame's next navigation, not a subframe's", async () => {
    const { hide, isHiddenInTab, onCommitted } = await setupSubject()
    await hide({ sender: { tab: { id: 7 } } })

    onCommitted({ tabId: 7, frameId: 3 })
    await settle()
    expect(await isHiddenInTab(7)).toBe(true)

    onCommitted({ tabId: 7, frameId: 0 })
    await settle()
    expect(await isHiddenInTab(7)).toBe(false)
  })

  it("clears when the tab closes", async () => {
    const { hide, isHiddenInTab, onRemoved } = await setupSubject()
    await hide({ sender: { tab: { id: 7 } } })

    onRemoved(7)
    await settle()

    expect(await isHiddenInTab(7)).toBe(false)
    expect(await fakeBrowser.storage.session.get(getSelectionToolbarHiddenKey(7))).toEqual({})
  })
})
