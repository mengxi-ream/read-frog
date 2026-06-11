import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"
import { DEFAULT_DETECTED_CODE } from "@/utils/constants/config"
import { getDetectedCodeStateKey, getTranslationStateKey } from "@/utils/constants/storage-keys"

const sendMessageMock = vi.fn()
const onMessageMock = vi.fn()
const storageGetItemMock = vi.fn()
const storageSetItemMock = vi.fn()
const storageRemoveItemMock = vi.fn()
const tabsOnRemovedAddListenerMock = vi.fn()
const tabsOnActivatedAddListenerMock = vi.fn()
const tabsQueryMock = vi.fn()
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

function getOnCommittedListener() {
  const listener = webNavigationOnCommittedAddListenerMock.mock.calls.at(-1)?.[0]
  if (!listener) {
    throw new Error("Expected webNavigation.onCommitted listener to be registered")
  }
  return listener as (details: { tabId: number, frameId: number, url: string }) => Promise<void>
}

function getOnRemovedListener() {
  const listener = tabsOnRemovedAddListenerMock.mock.calls.at(-1)?.[0]
  if (!listener) {
    throw new Error("Expected tabs.onRemoved listener to be registered")
  }
  return listener as (tabId: number) => Promise<void>
}

function getOnActivatedListener() {
  const listener = tabsOnActivatedAddListenerMock.mock.calls.at(-1)?.[0]
  if (!listener) {
    throw new Error("Expected tabs.onActivated listener to be registered")
  }
  return listener as (activeInfo: { tabId: number }) => Promise<void>
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
    browser.tabs.onActivated.addListener = tabsOnActivatedAddListenerMock
    browser.tabs.query = tabsQueryMock
    browser.webNavigation.onCommitted.addListener = webNavigationOnCommittedAddListenerMock
    storage.getItem = storageGetItemMock
    storage.setItem = storageSetItemMock
    storage.removeItem = storageRemoveItemMock

    onMessageMock.mockImplementation((name: string, handler: (msg: any) => any) => {
      messageHandlers.set(name, handler)
      return vi.fn()
    })
    sendMessageMock.mockResolvedValue(undefined)
    tabsQueryMock.mockResolvedValue([{ id: 42 }])
    storageGetItemMock.mockResolvedValue(undefined)
    storageSetItemMock.mockResolvedValue(undefined)
    storageRemoveItemMock.mockResolvedValue(undefined)
    shouldEnableAutoTranslationMock.mockResolvedValue(false)
  })

  it("persists manager-enabled state and injects current iframes from the top frame", async () => {
    await setupSubject()

    await getHandler("setAndNotifyPageTranslationStateChangedByManager")({
      data: { enabled: true, url: "https://example.com/articles/1" },
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getTranslationStateKey(42), {
      enabled: true,
      origin: "https://example.com",
    })
    expect(sendMessageMock).toHaveBeenCalledWith("notifyTranslationStateChanged", { enabled: true }, 42)
    expect(injectHostContentIntoTabIframesMock).toHaveBeenCalledWith(42)
  })

  it("does not overwrite tab state or reinject every iframe when an iframe manager echoes enabled state", async () => {
    await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: true, origin: "https://example.com" })

    await getHandler("setAndNotifyPageTranslationStateChangedByManager")({
      data: { enabled: true, url: "https://embed.example.net/frame" },
      sender: { tab: { id: 42 }, frameId: 7 },
    })

    expect(storageSetItemMock).not.toHaveBeenCalled()
    expect(sendMessageMock).toHaveBeenCalledWith("notifyTranslationStateChanged", { enabled: true }, 42)
    expect(injectHostContentIntoTabIframesMock).not.toHaveBeenCalled()
  })

  it("ignores enabled iframe manager echoes when tab translation is not already active", async () => {
    await setupSubject()
    storageGetItemMock.mockResolvedValue(undefined)

    await getHandler("setAndNotifyPageTranslationStateChangedByManager")({
      data: { enabled: true, url: "https://embed.example.net/frame" },
      sender: { tab: { id: 42 }, frameId: 7 },
    })

    expect(storageSetItemMock).not.toHaveBeenCalled()
    expect(sendMessageMock).not.toHaveBeenCalledWith("notifyTranslationStateChanged", { enabled: true }, 42)
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

  it("stores detected language by sender tab and notifies when it is the active tab", async () => {
    await setupSubject()
    tabsQueryMock.mockResolvedValue([{ id: 42 }])

    await getHandler("reportDetectedPageLanguage")({
      data: { detectedCodeOrUnd: "cmn", url: "https://zh.example.test" },
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getDetectedCodeStateKey(42), "cmn")
    expect(sendMessageMock).toHaveBeenCalledWith("detectedPageLanguageChanged", { detectedCode: "cmn" })
  })

  it("does not notify detected language from an inactive tab", async () => {
    await setupSubject()
    tabsQueryMock.mockResolvedValue([{ id: 7 }])

    await getHandler("reportDetectedPageLanguage")({
      data: { detectedCodeOrUnd: "jpn", url: "https://ja.example.test" },
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getDetectedCodeStateKey(42), "jpn")
    expect(sendMessageMock).not.toHaveBeenCalledWith("detectedPageLanguageChanged", { detectedCode: "jpn" })
  })

  it("normalizes undetected page language before caching", async () => {
    await setupSubject()

    await getHandler("reportDetectedPageLanguage")({
      data: { detectedCodeOrUnd: "und", url: "https://example.test" },
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getDetectedCodeStateKey(42), DEFAULT_DETECTED_CODE)
  })

  it("normalizes unsupported page language before caching and notifying", async () => {
    await setupSubject()
    tabsQueryMock.mockResolvedValue([{ id: 42 }])

    await getHandler("reportDetectedPageLanguage")({
      data: { detectedCodeOrUnd: "vmw", url: "https://example.test" },
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(storageSetItemMock).toHaveBeenCalledWith(getDetectedCodeStateKey(42), DEFAULT_DETECTED_CODE)
    expect(sendMessageMock).toHaveBeenCalledWith("detectedPageLanguageChanged", { detectedCode: DEFAULT_DETECTED_CODE })
  })

  it("returns the sender tab detected language to content scripts", async () => {
    await setupSubject()
    storageGetItemMock.mockImplementation(async (key: string) => {
      if (key === getDetectedCodeStateKey(42))
        return "jpn"
      return undefined
    })

    const detectedCode = await getHandler("getDetectedCode")({
      data: undefined,
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(detectedCode).toBe("jpn")
  })

  it("normalizes unsupported cached detected language for content scripts", async () => {
    await setupSubject()
    storageGetItemMock.mockImplementation(async (key: string) => {
      if (key === getDetectedCodeStateKey(42))
        return "vmw"
      return undefined
    })

    const detectedCode = await getHandler("getDetectedCode")({
      data: undefined,
      sender: { tab: { id: 42 }, frameId: 0 },
    })

    expect(detectedCode).toBe(DEFAULT_DETECTED_CODE)
  })

  it("returns the active tab detected language to extension pages", async () => {
    await setupSubject()
    tabsQueryMock.mockResolvedValue([{ id: 8 }])
    storageGetItemMock.mockImplementation(async (key: string) => {
      if (key === getDetectedCodeStateKey(8))
        return "cmn"
      return undefined
    })

    const detectedCode = await getHandler("getDetectedCode")({
      data: undefined,
      sender: {},
    })

    expect(detectedCode).toBe("cmn")
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

  it("publishes cached detected language and requests refresh when tabs are activated", async () => {
    await setupSubject()
    storageGetItemMock.mockImplementation(async (key: string) => {
      if (key === getDetectedCodeStateKey(1))
        return "cmn"
      if (key === getDetectedCodeStateKey(2))
        return "jpn"
      return undefined
    })

    const onActivated = getOnActivatedListener()
    await onActivated({ tabId: 1 })
    await onActivated({ tabId: 2 })

    expect(sendMessageMock).toHaveBeenCalledWith("detectedPageLanguageChanged", { detectedCode: "cmn" })
    expect(sendMessageMock).toHaveBeenCalledWith("detectedPageLanguageChanged", { detectedCode: "jpn" })
    expect(sendMessageMock).toHaveBeenCalledWith("refreshDetectedPageLanguage", undefined, 1)
    expect(sendMessageMock).toHaveBeenCalledWith("refreshDetectedPageLanguage", undefined, 2)
  })

  it("publishes default detected language when an activated tab has no cache", async () => {
    await setupSubject()

    await getOnActivatedListener()({ tabId: 42 })

    expect(sendMessageMock).toHaveBeenCalledWith("detectedPageLanguageChanged", { detectedCode: DEFAULT_DETECTED_CODE })
    expect(sendMessageMock).toHaveBeenCalledWith("refreshDetectedPageLanguage", undefined, 42)
  })

  it("clears detected language cache when a tab is removed", async () => {
    await setupSubject()

    await getOnRemovedListener()(42)

    expect(storageRemoveItemMock).toHaveBeenCalledWith(getTranslationStateKey(42))
    expect(storageRemoveItemMock).toHaveBeenCalledWith(getDetectedCodeStateKey(42))
  })

  it("keeps enabled translation state on same-origin top-frame navigation", async () => {
    await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: true, origin: "https://example.com" })

    await getOnCommittedListener()({
      tabId: 42,
      frameId: 0,
      url: "https://example.com/articles/2?from=feed#comments",
    })

    expect(storageRemoveItemMock).not.toHaveBeenCalled()
  })

  it("clears enabled translation state on cross-origin top-frame navigation", async () => {
    await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: true, origin: "https://example.com" })

    await getOnCommittedListener()({
      tabId: 42,
      frameId: 0,
      url: "https://other.example.com/articles/2",
    })

    expect(storageRemoveItemMock).toHaveBeenCalledWith(getTranslationStateKey(42))
  })

  it("does not clear translation state for iframe navigations", async () => {
    await setupSubject()

    await getOnCommittedListener()({
      tabId: 42,
      frameId: 3,
      url: "https://other.example.com/frame",
    })

    expect(storageGetItemMock).not.toHaveBeenCalled()
    expect(storageRemoveItemMock).not.toHaveBeenCalled()
  })
})
