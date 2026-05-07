import { browser, storage } from "#imports"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTranslationStateKey } from "@/utils/constants/storage-keys"

const sendMessageMock = vi.fn()
const onMessageMock = vi.fn()
const storageGetItemMock = vi.fn()
const storageSetItemMock = vi.fn()
const storageRemoveItemMock = vi.fn()
const tabsOnRemovedAddListenerMock = vi.fn()
const webNavigationOnCommittedAddListenerMock = vi.fn()
const injectHostContentIntoTabIframesMock = vi.fn()
const injectHostContentIntoCurrentTabIframesAfterNodeTranslationMock = vi.fn()
const loggerErrorMock = vi.fn()
const loggerWarnMock = vi.fn()
const shouldEnableAutoTranslationMock = vi.fn()

const messageHandlers = new Map<string, (msg: any) => any>()

vi.mock("@/utils/message", () => ({
  onMessage: onMessageMock,
  sendMessage: sendMessageMock,
}))

vi.mock("@/utils/host/translate/auto-translation", () => ({
  shouldEnableAutoTranslation: shouldEnableAutoTranslationMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}))

vi.mock("../iframe-injection", () => ({
  injectHostContentIntoTabIframes: injectHostContentIntoTabIframesMock,
  injectHostContentIntoCurrentTabIframesAfterNodeTranslation: injectHostContentIntoCurrentTabIframesAfterNodeTranslationMock,
}))

function getHandler(name: string) {
  const handler = messageHandlers.get(name)
  if (!handler) {
    throw new Error(`Expected message handler to be registered: ${name}`)
  }
  return handler
}

async function setupSubject() {
  const { translationMessage } = await import("../translation-signal")
  translationMessage()
}

describe("translationMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    messageHandlers.clear()

    browser.tabs.onRemoved.addListener = tabsOnRemovedAddListenerMock
    browser.webNavigation.onCommitted.addListener = webNavigationOnCommittedAddListenerMock
    storage.getItem = storageGetItemMock
    storage.setItem = storageSetItemMock
    storage.removeItem = storageRemoveItemMock

    onMessageMock.mockImplementation((name: string, handler: (msg: any) => any) => {
      messageHandlers.set(name, handler)
      return vi.fn()
    })
    sendMessageMock.mockResolvedValue(undefined)
    storageGetItemMock.mockResolvedValue(undefined)
    storageSetItemMock.mockResolvedValue(undefined)
    storageRemoveItemMock.mockResolvedValue(undefined)
    shouldEnableAutoTranslationMock.mockResolvedValue(false)
  })

  it("persists manager-enabled state and injects current iframes from the top frame", async () => {
    await setupSubject()

    await getHandler("setAndNotifyPageTranslationStateChangedByManager")({
      data: { enabled: true },
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), { enabled: true })
    expect(sendMessageMock).toHaveBeenCalledWith("notifyTranslationStateChanged", { enabled: true }, 42)
    expect(injectHostContentIntoTabIframesMock).toHaveBeenCalledWith(42)
  })

  it("does not reinject every iframe when an iframe manager echoes enabled state", async () => {
    await setupSubject()

    await getHandler("setAndNotifyPageTranslationStateChangedByManager")({
      data: { enabled: true },
      sender: { tab: { id: 42 }, frameId: 7 },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), { enabled: true })
    expect(sendMessageMock).toHaveBeenCalledWith("notifyTranslationStateChanged", { enabled: true }, 42)
    expect(injectHostContentIntoTabIframesMock).not.toHaveBeenCalled()
  })

  it("clears state immediately when a tab-level request disables page translation", async () => {
    await setupSubject()

    await getHandler("tryToSetEnablePageTranslationByTabId")({
      data: { tabId: 42, enabled: false },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), { enabled: false })
    expect(sendMessageMock).toHaveBeenCalledWith("notifyTranslationStateChanged", { enabled: false }, 42)
    expect(sendMessageMock).toHaveBeenCalledWith("askManagerToTogglePageTranslation", {
      enabled: false,
      analyticsContext: undefined,
    }, 42)
  })

  it("injects current iframes when explicitly asked for a tab", async () => {
    await setupSubject()

    await getHandler("ensureIframeHostContentInjected")({
      data: { tabId: 42 },
    })

    expect(injectHostContentIntoTabIframesMock).toHaveBeenCalledWith(42)
  })

  it("does not inject current iframes without a valid tab id", async () => {
    await setupSubject()

    await getHandler("ensureIframeHostContentInjected")({
      data: {},
      sender: {},
    })

    expect(injectHostContentIntoTabIframesMock).not.toHaveBeenCalled()
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Invalid tabId in ensureIframeHostContentInjected",
      expect.objectContaining({
        data: {},
        sender: {},
      }),
    )
  })

  it("injects current iframes after successful top-frame node translation", async () => {
    await setupSubject()

    await getHandler("injectCurrentIframesAfterTopFrameNodeTranslation")({
      data: undefined,
      sender: {
        tab: { id: 42 },
        frameId: 0,
      },
    })

    expect(injectHostContentIntoCurrentTabIframesAfterNodeTranslationMock).toHaveBeenCalledWith(42)
    expect(injectHostContentIntoTabIframesMock).not.toHaveBeenCalled()
  })

  it("rejects iframe senders for top-frame node translation iframe injection", async () => {
    await setupSubject()

    await getHandler("injectCurrentIframesAfterTopFrameNodeTranslation")({
      data: undefined,
      sender: { tab: { id: 42 }, frameId: 7 },
    })

    expect(injectHostContentIntoCurrentTabIframesAfterNodeTranslationMock).not.toHaveBeenCalled()
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Invalid sender in injectCurrentIframesAfterTopFrameNodeTranslation",
      expect.objectContaining({
        sender: { tab: { id: 42 }, frameId: 7 },
      }),
    )
  })

  it("waits for the top-frame manager to validate before enabling iframe injection", async () => {
    await setupSubject()

    await getHandler("tryToSetEnablePageTranslationByTabId")({
      data: { tabId: 42, enabled: true },
    })

    expect(storageSetItemMock).not.toHaveBeenCalled()
    expect(injectHostContentIntoTabIframesMock).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledWith("askManagerToTogglePageTranslation", {
      enabled: true,
      analyticsContext: undefined,
    }, 42)
  })
})
