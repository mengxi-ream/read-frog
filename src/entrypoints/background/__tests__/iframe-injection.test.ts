import { beforeEach, describe, expect, it, vi } from "vitest"
import { SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"

const tabsOnRemovedAddListenerMock = vi.fn()
const webNavigationOnBeforeNavigateAddListenerMock = vi.fn()
const webNavigationOnCompletedAddListenerMock = vi.fn()
const getAllFramesMock = vi.fn()
const executeScriptMock = vi.fn()

const getLocalConfigMock = vi.fn()
const loggerErrorMock = vi.fn()
const loggerWarnMock = vi.fn()

const browserMock = {
  tabs: {
    onRemoved: {
      addListener: tabsOnRemovedAddListenerMock,
    },
  },
  webNavigation: {
    onBeforeNavigate: {
      addListener: webNavigationOnBeforeNavigateAddListenerMock,
    },
    onCompleted: {
      addListener: webNavigationOnCompletedAddListenerMock,
    },
    getAllFrames: getAllFramesMock,
  },
  scripting: {
    executeScript: executeScriptMock,
  },
}

vi.mock("#imports", () => ({
  browser: browserMock,
}))

vi.mock("wxt/browser", () => ({
  browser: browserMock,
}))

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

    getLocalConfigMock.mockResolvedValue(null)
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://example.com/app", -1),
      createFrame(2, "https://example.com/frame"),
    ])
    executeScriptMock.mockResolvedValue(undefined)
  })

  it("injects each document once and targets documentIds when available", async () => {
    const { onCompleted } = await setupSubject()
    const details = createDetails()

    await onCompleted(details)
    await onCompleted(details)

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
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

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    for (const [call] of executeScriptMock.mock.calls) {
      expect(call.target).toEqual({ tabId: currentTabId, frameIds: [2] })
    }
  })

  it("clears per-frame injected state when a subframe starts navigating", async () => {
    const { onBeforeNavigate, onCompleted } = await setupSubject()
    const details = createDetails()

    await onCompleted(details)
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(3)

    onBeforeNavigate({ tabId: currentTabId, frameId: 2 })
    await onCompleted(details)

    expect(executeScriptMock).toHaveBeenCalledTimes(6)
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

    expect(executeScriptMock).toHaveBeenCalledTimes(9)
    expect(executeScriptMock).toHaveBeenLastCalledWith(expect.objectContaining({
      target: { tabId: currentTabId, documentIds: ["doc-stale"] },
      files: ["/content-scripts/selection.js"],
    }))
  })

  it("clears tab state on main-frame navigation and tab removal", async () => {
    const { onBeforeNavigate, onCompleted, onRemoved } = await setupSubject()
    const details = createDetails()

    await onCompleted(details)
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(3)

    onBeforeNavigate({ tabId: currentTabId, frameId: 0 })
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(6)

    onRemoved(currentTabId)
    await onCompleted(details)
    expect(executeScriptMock).toHaveBeenCalledTimes(9)
  })
})
