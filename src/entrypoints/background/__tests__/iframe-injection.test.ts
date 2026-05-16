import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"
import { SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"

const HOST_CONTENT_SCRIPT_FILE = "/content-scripts/host.js"
const SELECTION_CONTENT_SCRIPT_FILE = "/content-scripts/selection.js"

const tabsOnRemovedAddListenerMock = vi.fn()
const webNavigationOnBeforeNavigateAddListenerMock = vi.fn()
const webNavigationOnCompletedAddListenerMock = vi.fn()
const getAllFramesMock = vi.fn()
const executeScriptMock = vi.fn()
const storageGetItemMock = vi.fn()

const getLocalConfigMock = vi.fn()
const loggerErrorMock = vi.fn()
const loggerWarnMock = vi.fn()

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}))

interface NavigationDetails {
  tabId: number
  frameId: number
  documentId?: string
  parentFrameId?: number
  url?: string
}

interface FrameInfo {
  frameId: number
  parentFrameId: number
  url?: string
}

let currentTabId = 0

function createFrame(frameId: number, url: string, parentFrameId = 0): FrameInfo {
  return { frameId, parentFrameId, url }
}

function createDetails(overrides: Partial<NavigationDetails> = {}): NavigationDetails {
  return {
    tabId: currentTabId,
    frameId: 2,
    documentId: "doc-1",
    parentFrameId: 0,
    url: "https://example.com/frame",
    ...overrides,
  }
}

function createConfig({
  nodeTranslationEnabled = false,
  siteControl,
}: {
  nodeTranslationEnabled?: boolean
  siteControl?: Config["siteControl"]
} = {}): Config {
  return {
    translate: {
      node: {
        enabled: nodeTranslationEnabled,
      },
    },
    siteControl: siteControl ?? {
      mode: "blacklist",
      blacklistPatterns: [],
      whitelistPatterns: [],
    },
  } as unknown as Config
}

async function setupSubject() {
  const { setupIframeInjection } = await import("../iframe-injection")
  setupIframeInjection()

  const onRemoved = tabsOnRemovedAddListenerMock.mock.calls.at(-1)?.[0] as ((tabId: number) => void) | undefined
  const onBeforeNavigate = webNavigationOnBeforeNavigateAddListenerMock.mock.calls.at(-1)?.[0] as
    | ((details: NavigationDetails) => void)
    | undefined
  const onCompleted = webNavigationOnCompletedAddListenerMock.mock.calls.at(-1)?.[0] as
    | ((details: NavigationDetails) => Promise<void>)
    | undefined

  if (!onRemoved || !onBeforeNavigate || !onCompleted) {
    throw new Error("Expected iframe injection listeners to be registered")
  }

  return {
    onRemoved,
    onBeforeNavigate,
    onCompleted,
  }
}

describe("setupIframeInjection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentTabId += 1

    browser.tabs.onRemoved.addListener = tabsOnRemovedAddListenerMock
    browser.webNavigation.onBeforeNavigate.addListener = webNavigationOnBeforeNavigateAddListenerMock
    browser.webNavigation.onCompleted.addListener = webNavigationOnCompletedAddListenerMock
    browser.webNavigation.getAllFrames = getAllFramesMock
    browser.scripting.executeScript = executeScriptMock
    storage.getItem = storageGetItemMock

    getLocalConfigMock.mockResolvedValue(null)
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://example.com/app", -1),
      createFrame(2, "https://example.com/frame"),
    ])
    storageGetItemMock.mockResolvedValue({ enabled: true })
    executeScriptMock.mockResolvedValue(undefined)
  })

  it("skips iframe injection when page translation and node translation are not enabled", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: false }))

    await onCompleted(createDetails())

    expect(getAllFramesMock).not.toHaveBeenCalled()
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("skips eager iframe injection when only node translation is enabled", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: true }))

    await onCompleted(createDetails())

    expect(getAllFramesMock).not.toHaveBeenCalled()
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("injects host content when page translation is enabled", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: true })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: false }))

    await onCompleted(createDetails())

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-1"] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    }))
    expect(executeScriptMock).not.toHaveBeenCalledWith(expect.objectContaining({
      files: [SELECTION_CONTENT_SCRIPT_FILE],
    }))
  })

  it("auto-injects host and selection content for allowlisted iframes when page translation is disabled", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: false }))

    await onCompleted(createDetails({
      url: "https://browse.library.kiwix.org/content/wikipedia_en_all_maxi_2026-02/A/Computer_science",
    }))

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-1"] },
      func: expect.any(Function),
      args: [
        SITE_CONTROL_URL_WINDOW_KEY,
        "https://browse.library.kiwix.org/content/wikipedia_en_all_maxi_2026-02/A/Computer_science",
      ],
    }))
    expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-1"] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    }))
    expect(executeScriptMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-1"] },
      files: [SELECTION_CONTENT_SCRIPT_FILE],
    }))
  })

  it("auto-injects existing and late iframes for allowlisted top pages", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: false }))
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://browse.library.kiwix.org/viewer", -1),
      createFrame(2, "https://reader.example/frame"),
    ])

    await onCompleted(createDetails({
      frameId: 0,
      documentId: "top-doc",
      parentFrameId: -1,
      url: "https://browse.library.kiwix.org/viewer",
    }))

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      args: [SITE_CONTROL_URL_WINDOW_KEY, "https://browse.library.kiwix.org/viewer"],
    }))
    expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    }))
    expect(executeScriptMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      files: [SELECTION_CONTENT_SCRIPT_FILE],
    }))

    executeScriptMock.mockClear()
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://browse.library.kiwix.org/viewer", -1),
      createFrame(4, "https://reader.example/late-frame"),
    ])

    await onCompleted(createDetails({
      frameId: 4,
      documentId: "doc-late",
      url: "https://reader.example/late-frame",
    }))

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-late"] },
      args: [SITE_CONTROL_URL_WINDOW_KEY, "https://browse.library.kiwix.org/viewer"],
    }))
    expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-late"] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    }))
    expect(executeScriptMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-late"] },
      files: [SELECTION_CONTENT_SCRIPT_FILE],
    }))
  })

  it("respects site control during allowlisted full-runtime iframe injection", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({
      nodeTranslationEnabled: false,
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: ["browse.library.kiwix.org"],
        whitelistPatterns: [],
      },
    }))
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://browse.library.kiwix.org/viewer", -1),
      createFrame(2, "https://reader.example/frame"),
    ])

    await onCompleted(createDetails({
      frameId: 0,
      documentId: "top-doc",
      parentFrameId: -1,
      url: "https://browse.library.kiwix.org/viewer",
    }))

    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("dedupes host and selection iframe injection independently", async () => {
    const { injectHostContentIntoTabIframes } = await import("../iframe-injection")
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: false }))
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://browse.library.kiwix.org/viewer", -1),
      createFrame(2, "https://browse.library.kiwix.org/content/article"),
    ])

    await injectHostContentIntoTabIframes(currentTabId, { requirePageTranslationEnabled: false })

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    }))

    executeScriptMock.mockClear()

    await injectHostContentIntoTabIframes(currentTabId, {
      requirePageTranslationEnabled: false,
      includeSelectionContent: true,
    })

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      args: [SITE_CONTROL_URL_WINDOW_KEY, "https://browse.library.kiwix.org/content/article"],
    }))
    expect(executeScriptMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      files: [SELECTION_CONTENT_SCRIPT_FILE],
    }))
    expect(executeScriptMock).not.toHaveBeenCalledWith(expect.objectContaining({
      files: [HOST_CONTENT_SCRIPT_FILE],
    }))
  })

  it("injects each document once and targets documentIds when available", async () => {
    const { onCompleted } = await setupSubject()
    const details = createDetails()

    await onCompleted(details)
    await onCompleted(details)

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    expect(executeScriptMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-1"] },
      func: expect.any(Function),
      args: [SITE_CONTROL_URL_WINDOW_KEY, "https://example.com/frame"],
    }))

    for (const [call] of executeScriptMock.mock.calls) {
      expect(call.target).toEqual({ tabId: currentTabId, documentIds: ["doc-1"] })
    }
  })

  it("falls back to frameIds targeting when documentId is unavailable", async () => {
    const { onCompleted } = await setupSubject()

    await onCompleted(createDetails({ documentId: undefined }))

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    for (const [call] of executeScriptMock.mock.calls) {
      expect(call.target).toEqual({ tabId: currentTabId, frameIds: [2] })
    }
  })

  it("clears per-frame injected state when a subframe starts navigating", async () => {
    const { onBeforeNavigate, onCompleted } = await setupSubject()
    const details = createDetails()

    await onCompleted(details)
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(2)

    onBeforeNavigate({ tabId: currentTabId, frameId: 2 })
    await onCompleted(details)

    expect(executeScriptMock).toHaveBeenCalledTimes(4)
  })

  it("prunes injected records for frames that are no longer live", async () => {
    const { onCompleted } = await setupSubject()

    getAllFramesMock
      .mockResolvedValueOnce([
        createFrame(0, "https://example.com/app", -1),
        createFrame(3, "https://example.com/old-frame"),
      ])
      .mockResolvedValueOnce([
        createFrame(0, "https://example.com/app", -1),
        createFrame(2, "https://example.com/frame"),
      ])
      .mockResolvedValueOnce([
        createFrame(0, "https://example.com/app", -1),
        createFrame(3, "https://example.com/old-frame"),
      ])

    await onCompleted(createDetails({
      frameId: 3,
      documentId: "doc-stale",
      url: "https://example.com/old-frame",
    }))
    await onCompleted(createDetails({
      frameId: 2,
      documentId: "doc-live",
      url: "https://example.com/frame",
    }))
    await onCompleted(createDetails({
      frameId: 3,
      documentId: "doc-stale",
      url: "https://example.com/old-frame",
    }))

    expect(executeScriptMock).toHaveBeenCalledTimes(6)
    expect(executeScriptMock).toHaveBeenLastCalledWith(expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-stale"] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    }))
  })

  it("clears tab state on main-frame navigation and tab removal", async () => {
    const { onBeforeNavigate, onCompleted, onRemoved } = await setupSubject()
    const details = createDetails()

    await onCompleted(details)
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(2)

    onBeforeNavigate({ tabId: currentTabId, frameId: 0 })
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(4)

    onRemoved(currentTabId)
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(6)
  })

  it("injects current tab iframes after top-frame node translation even when page translation is disabled", async () => {
    const { injectHostContentIntoCurrentTabIframesAfterNodeTranslation } = await import("../iframe-injection")
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: true }))
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://example.com/app", -1),
      createFrame(2, "https://example.com/frame-a"),
      createFrame(3, "https://example.com/frame-b"),
    ])

    await injectHostContentIntoCurrentTabIframesAfterNodeTranslation(currentTabId)

    const calls = executeScriptMock.mock.calls.map(([call]) => call)
    expect(executeScriptMock).toHaveBeenCalledTimes(4)
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      func: expect.any(Function),
      args: [SITE_CONTROL_URL_WINDOW_KEY, "https://example.com/frame-a"],
    })]))
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [2] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    })]))
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [3] },
      func: expect.any(Function),
      args: [SITE_CONTROL_URL_WINDOW_KEY, "https://example.com/frame-b"],
    })]))
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({
      target: { tabId: currentTabId, frameIds: [3] },
      files: [HOST_CONTENT_SCRIPT_FILE],
    })]))
  })

  it("respects site control during top-frame node activation iframe injection", async () => {
    const { injectHostContentIntoCurrentTabIframesAfterNodeTranslation } = await import("../iframe-injection")
    getLocalConfigMock.mockResolvedValue(createConfig({
      nodeTranslationEnabled: true,
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: ["example.com"],
        whitelistPatterns: [],
      },
    }))

    await injectHostContentIntoCurrentTabIframesAfterNodeTranslation(currentTabId)

    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("does not enable late iframe injection after top-frame node activation", async () => {
    const { onCompleted } = await setupSubject()
    const { injectHostContentIntoCurrentTabIframesAfterNodeTranslation } = await import("../iframe-injection")
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: true }))

    await injectHostContentIntoCurrentTabIframesAfterNodeTranslation(currentTabId)
    executeScriptMock.mockClear()
    getAllFramesMock.mockClear()

    await onCompleted(createDetails({
      frameId: 4,
      documentId: "doc-late",
      url: "https://example.com/late-frame",
    }))

    expect(getAllFramesMock).not.toHaveBeenCalled()
    expect(executeScriptMock).not.toHaveBeenCalled()
  })
})
