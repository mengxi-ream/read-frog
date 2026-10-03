import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { SITE_CONTROL_URL_WINDOW_KEY } from "@/utils/site-control"

const HOST_CONTENT_SCRIPT_FILE = "/content-scripts/host.js"
const SELECTION_CONTENT_SCRIPT_FILE = "/content-scripts/selection.js"

const tabsOnRemovedAddListenerMock = vi.fn<(...args: any[]) => any>()
const webNavigationOnBeforeNavigateAddListenerMock = vi.fn<(...args: any[]) => any>()
const webNavigationOnCompletedAddListenerMock = vi.fn<(...args: any[]) => any>()
const getAllFramesMock = vi.fn<(...args: any[]) => any>()
const executeScriptMock = vi.fn<(...args: any[]) => any>()
const tabsGetMock = vi.fn<(...args: any[]) => any>()
const storageGetItemMock = vi.fn<(...args: any[]) => any>()

// Hoisted: `@/utils/site-control` reaches `@/utils/logger` through the shared URL
// matcher, so the mocked module is evaluated before a plain `const` here would be
// initialised.
const { getLocalConfigMock, loggerErrorMock, loggerWarnMock, onMessageMock } = vi.hoisted(() => ({
  getLocalConfigMock: vi.fn<(...args: any[]) => any>(),
  loggerErrorMock: vi.fn<(...args: any[]) => any>(),
  loggerWarnMock: vi.fn<(...args: any[]) => any>(),
  onMessageMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({ onMessage: onMessageMock }))

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
  documentId?: string
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
  siteRules,
  eagerIframeInjection = false,
}: {
  nodeTranslationEnabled?: boolean
  siteControl?: Config["siteControl"]
  siteRules?: Config["siteRules"]
  eagerIframeInjection?: boolean
} = {}): Config {
  return {
    selectionToolbar: DEFAULT_CONFIG.selectionToolbar,
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
    siteRules: siteRules ?? {
      userRules: eagerIframeInjection
        ? [{ id: "reader-iframes", matches: "reader.example", injectIntoIframes: true }]
        : [],
      disabledBuiltInRules: [],
    },
  } as unknown as Config
}

async function setupSubject() {
  const { setupIframeInjection } = await import("../iframe-injection")
  setupIframeInjection()

  const onRemoved = tabsOnRemovedAddListenerMock.mock.calls.at(-1)?.[0] as
    | ((tabId: number) => void)
    | undefined
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
    activateSelection: onMessageMock.mock.calls.find(
      ([type]) => type === "activateSameOriginIframeSelectionRuntime",
    )![1] as (message: { sender: Record<string, unknown> }) => Promise<boolean>,
  }
}

describe("setupIframeInjection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentTabId += 1

    browser.tabs.onRemoved.addListener = tabsOnRemovedAddListenerMock
    browser.tabs.get = tabsGetMock
    browser.webNavigation.onBeforeNavigate.addListener =
      webNavigationOnBeforeNavigateAddListenerMock
    browser.webNavigation.onCompleted.addListener = webNavigationOnCompletedAddListenerMock
    browser.webNavigation.getAllFrames = getAllFramesMock
    browser.scripting.executeScript = executeScriptMock
    storage.getItem = storageGetItemMock

    getLocalConfigMock.mockResolvedValue(null)
    tabsGetMock.mockResolvedValue({ url: "https://example.com/app" })
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://example.com/app", -1),
      createFrame(2, "https://example.com/frame"),
    ])
    storageGetItemMock.mockResolvedValue({ enabled: true })
    executeScriptMock.mockResolvedValue(undefined)
  })

  it("loads both runtimes only when a same-origin iframe selection requests them", async () => {
    const { activateSelection } = await setupSubject()
    getLocalConfigMock.mockResolvedValue(createConfig())
    storageGetItemMock.mockResolvedValue({ enabled: false })
    expect(
      await activateSelection({
        sender: {
          tab: { id: currentTabId },
          frameId: 2,
          documentId: "doc-1",
          url: "https://example.com/frame",
          origin: "https://example.com",
        },
      }),
    ).toBe(true)
    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [SELECTION_CONTENT_SCRIPT_FILE],
        target: { tabId: currentTabId, documentIds: ["doc-1"] },
      }),
    )
  })

  it.each([
    { frameId: 0, origin: "https://example.com", url: "https://example.com/app" },
    { frameId: 2, origin: "https://ads.example", url: "https://ads.example/frame" },
    { frameId: 2, origin: "null", url: "https://example.com/frame" },
  ])("rejects an ineligible selection sender ($origin, frame $frameId)", async (sender) => {
    const { activateSelection } = await setupSubject()
    expect(await activateSelection({ sender: { ...sender, tab: { id: currentTabId } } })).toBe(
      false,
    )
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("supports inherited blank origins and refuses a stale document", async () => {
    const { activateSelection } = await setupSubject()
    getLocalConfigMock.mockResolvedValue(createConfig())
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://example.com/app", -1),
      { ...createFrame(2, "about:srcdoc"), documentId: "current-doc" },
    ])
    const sender = {
      tab: { id: currentTabId },
      frameId: 2,
      url: "about:srcdoc",
      origin: "https://example.com",
    }
    expect(await activateSelection({ sender: { ...sender, documentId: "old-doc" } })).toBe(false)
    expect(executeScriptMock).not.toHaveBeenCalled()
    expect(await activateSelection({ sender: { ...sender, documentId: "current-doc" } })).toBe(true)
  })

  it("honors explicit false and disabled site control for lazy activation", async () => {
    const { activateSelection } = await setupSubject()
    const message = {
      sender: {
        tab: { id: currentTabId },
        frameId: 2,
        url: "https://example.com/frame",
        origin: "https://example.com",
      },
    }
    getLocalConfigMock.mockResolvedValue(
      createConfig({
        siteRules: {
          userRules: [{ id: "off", matches: "example.com/app", injectIntoIframes: false }],
          disabledBuiltInRules: [],
        },
      }),
    )
    expect(await activateSelection(message)).toBe(false)
    getLocalConfigMock.mockResolvedValue(
      createConfig({
        siteControl: {
          mode: "blacklist",
          blacklistPatterns: ["example.com"],
          whitelistPatterns: [],
        },
      }),
    )
    expect(await activateSelection(message)).toBe(false)
    expect(executeScriptMock).not.toHaveBeenCalled()
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
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-1"] },
        files: [HOST_CONTENT_SCRIPT_FILE],
      }),
    )
    expect(executeScriptMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )
  })

  it("auto-injects host and selection content for rule-enabled iframes when page translation is disabled", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(
      createConfig({ nodeTranslationEnabled: false, eagerIframeInjection: true }),
    )

    await onCompleted(
      createDetails({
        url: "https://reader.example/content/wikipedia_en_all_maxi_2026-02/A/Computer_science",
      }),
    )

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-1"] },
        func: expect.any(Function),
        args: [
          SITE_CONTROL_URL_WINDOW_KEY,
          "https://reader.example/content/wikipedia_en_all_maxi_2026-02/A/Computer_science",
        ],
      }),
    )
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-1"] },
        files: [HOST_CONTENT_SCRIPT_FILE],
      }),
    )
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-1"] },
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )
  })

  it("auto-injects existing and late iframes for rule-enabled top pages", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(
      createConfig({ nodeTranslationEnabled: false, eagerIframeInjection: true }),
    )
    tabsGetMock.mockResolvedValue({ url: "https://reader.example/viewer" })
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://reader.example/viewer", -1),
      createFrame(2, "https://embedded.example/frame"),
    ])

    await onCompleted(
      createDetails({
        frameId: 0,
        documentId: "top-doc",
        parentFrameId: -1,
        url: "https://reader.example/viewer",
      }),
    )

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        target: { tabId: currentTabId, frameIds: [2] },
        args: [SITE_CONTROL_URL_WINDOW_KEY, "https://reader.example/viewer"],
      }),
    )
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: { tabId: currentTabId, frameIds: [2] },
        files: [HOST_CONTENT_SCRIPT_FILE],
      }),
    )
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        target: { tabId: currentTabId, frameIds: [2] },
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )

    executeScriptMock.mockClear()
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://reader.example/viewer", -1),
      createFrame(4, "https://embedded.example/late-frame"),
    ])

    await onCompleted(
      createDetails({
        frameId: 4,
        documentId: "doc-late",
        url: "https://embedded.example/late-frame",
      }),
    )

    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-late"] },
        args: [SITE_CONTROL_URL_WINDOW_KEY, "https://reader.example/viewer"],
      }),
    )
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-late"] },
        files: [HOST_CONTENT_SCRIPT_FILE],
      }),
    )
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-late"] },
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )
  })

  it("respects site control during rule-enabled full-runtime iframe injection", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(
      createConfig({
        nodeTranslationEnabled: false,
        eagerIframeInjection: true,
        siteControl: {
          mode: "blacklist",
          blacklistPatterns: ["reader.example"],
          whitelistPatterns: [],
        },
      }),
    )
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://reader.example/viewer", -1),
      createFrame(2, "https://embedded.example/frame"),
    ])

    await onCompleted(
      createDetails({
        frameId: 0,
        documentId: "top-doc",
        parentFrameId: -1,
        url: "https://reader.example/viewer",
      }),
    )

    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("injects current and late cross-origin or blank frames from a user rule on the top URL", async () => {
    const { onBeforeNavigate, onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    const topUrl = "https://example.com/app"
    getLocalConfigMock.mockResolvedValue(
      createConfig({
        siteRules: {
          userRules: [{ id: "reader", matches: "example.com/app", injectIntoIframes: true }],
          disabledBuiltInRules: [],
        },
      }),
    )
    getAllFramesMock.mockResolvedValue([
      createFrame(0, topUrl, -1),
      createFrame(2, "https://other.example/article"),
    ])
    onBeforeNavigate(createDetails({ frameId: 0, url: topUrl }))
    await onCompleted(createDetails({ frameId: 0, url: topUrl }))
    expect(executeScriptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: currentTabId, frameIds: [2] },
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )

    executeScriptMock.mockClear()
    getAllFramesMock.mockResolvedValue([createFrame(0, topUrl, -1), createFrame(4, "about:srcdoc")])
    await onCompleted(createDetails({ frameId: 4, documentId: "late-doc", url: "about:srcdoc" }))
    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    expect(executeScriptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [SITE_CONTROL_URL_WINDOW_KEY, topUrl],
      }),
    )
    expect(executeScriptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["late-doc"] },
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )
  })

  it("dedupes concurrent top-page scanning and frame completion for the same document", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    const url = "https://reader.example/viewer/"
    tabsGetMock.mockResolvedValue({ url })
    getLocalConfigMock.mockResolvedValue(createConfig({ eagerIframeInjection: true }))
    getAllFramesMock.mockResolvedValue([
      createFrame(0, url, -1),
      { ...createFrame(2, `${url}attachments/sandbox-1/`), documentId: "doc-1" },
    ])
    await Promise.all([
      onCompleted(createDetails({ frameId: 0, url })),
      onCompleted(createDetails({ url: `${url}attachments/sandbox-1/` })),
    ])
    expect(executeScriptMock).toHaveBeenCalledTimes(3)
    for (const [call] of executeScriptMock.mock.calls) {
      expect(call.target).toEqual({ tabId: currentTabId, documentIds: ["doc-1"] })
    }
  })

  it("recovers the top-page rule after a service worker restart", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    tabsGetMock.mockResolvedValue({ url: "https://reader.example/viewer" })
    getLocalConfigMock.mockResolvedValue(createConfig({ eagerIframeInjection: true }))
    await onCompleted(createDetails({ url: "https://other.example/frame" }))
    expect(executeScriptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )
    expect(executeScriptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [SITE_CONTROL_URL_WINDOW_KEY, "https://reader.example/viewer"],
      }),
    )
  })

  it.each(["false override", "disabled user rule"])(
    "honors %s when disabling eager iframe injection",
    async (mode) => {
      const { onCompleted } = await setupSubject()
      storageGetItemMock.mockResolvedValue({ enabled: false })
      const url = "https://reader.example/viewer"
      tabsGetMock.mockResolvedValue({ url })
      getLocalConfigMock.mockResolvedValue(
        createConfig({
          siteRules: {
            userRules:
              mode === "false override"
                ? [
                    { id: "enabled", matches: "reader.example", injectIntoIframes: true },
                    { id: "off", matches: "reader.example", injectIntoIframes: false },
                  ]
                : [
                    {
                      id: "disabled",
                      matches: "reader.example",
                      injectIntoIframes: true,
                      enabled: false,
                    },
                  ],
            disabledBuiltInRules: [],
          },
        }),
      )
      await onCompleted(createDetails({ frameId: 0, url }))
      await onCompleted(createDetails({ url: `${url}/article` }))
      expect(getAllFramesMock).not.toHaveBeenCalled()
      expect(executeScriptMock).not.toHaveBeenCalled()
    },
  )

  it("rechecks rule changes before injecting a late iframe", async () => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    const url = "https://reader.example/viewer"
    tabsGetMock.mockResolvedValue({ url })
    getLocalConfigMock.mockResolvedValue(createConfig({ eagerIframeInjection: true }))
    await onCompleted(createDetails({ frameId: 0, url }))
    executeScriptMock.mockClear()
    getLocalConfigMock.mockResolvedValue(
      createConfig({
        siteRules: {
          userRules: [{ id: "disable", matches: "*.reader.example", injectIntoIframes: false }],
          disabledBuiltInRules: [],
        },
      }),
    )
    await onCompleted(createDetails({ frameId: 4, url: "https://other.example/late" }))
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("does not carry an enabled top-page rule into the next navigation", async () => {
    const { onBeforeNavigate, onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ eagerIframeInjection: true }))
    await onCompleted(createDetails({ frameId: 0, url: "https://reader.example/viewer" }))
    executeScriptMock.mockClear()
    onBeforeNavigate(createDetails({ frameId: 0, url: "https://example.com/app" }))
    await onCompleted(createDetails())
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      id: "excluded",
      matches: "example.com",
      excludeMatches: ["example.com/app"],
      injectIntoIframes: true,
    },
    { id: "disabled", matches: "example.com", enabled: false, injectIntoIframes: true },
  ])("does not activate a filtered user rule ($id)", async (rule) => {
    const { onCompleted } = await setupSubject()
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(
      createConfig({
        siteRules: { userRules: [rule], disabledBuiltInRules: [] },
      }),
    )
    await onCompleted(createDetails({ url: "https://other.example/frame" }))
    expect(getAllFramesMock).not.toHaveBeenCalled()
    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("dedupes host and selection iframe injection independently", async () => {
    const { injectHostContentIntoTabIframes } = await import("../iframe-injection")
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: false }))
    getAllFramesMock.mockResolvedValue([
      createFrame(0, "https://reader.example/viewer", -1),
      createFrame(2, "https://reader.example/content/article"),
    ])

    await injectHostContentIntoTabIframes(currentTabId, { requirePageTranslationEnabled: false })

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: { tabId: currentTabId, frameIds: [2] },
        files: [HOST_CONTENT_SCRIPT_FILE],
      }),
    )

    executeScriptMock.mockClear()

    await injectHostContentIntoTabIframes(currentTabId, {
      requirePageTranslationEnabled: false,
      includeSelectionContent: true,
    })

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        target: { tabId: currentTabId, frameIds: [2] },
        args: [SITE_CONTROL_URL_WINDOW_KEY, "https://reader.example/content/article"],
      }),
    )
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: { tabId: currentTabId, frameIds: [2] },
        files: [SELECTION_CONTENT_SCRIPT_FILE],
      }),
    )
    expect(executeScriptMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        files: [HOST_CONTENT_SCRIPT_FILE],
      }),
    )
  })

  it("injects each document once and targets documentIds when available", async () => {
    const { onCompleted } = await setupSubject()
    const details = createDetails()

    await onCompleted(details)
    await onCompleted(details)

    expect(executeScriptMock).toHaveBeenCalledTimes(2)
    expect(executeScriptMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-1"] },
        func: expect.any(Function),
        args: [SITE_CONTROL_URL_WINDOW_KEY, "https://example.com/frame"],
      }),
    )

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

    await onCompleted(
      createDetails({
        frameId: 3,
        documentId: "doc-stale",
        url: "https://example.com/old-frame",
      }),
    )
    await onCompleted(
      createDetails({
        frameId: 2,
        documentId: "doc-live",
        url: "https://example.com/frame",
      }),
    )
    await onCompleted(
      createDetails({
        frameId: 3,
        documentId: "doc-stale",
        url: "https://example.com/old-frame",
      }),
    )

    expect(executeScriptMock).toHaveBeenCalledTimes(6)
    expect(executeScriptMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: { tabId: currentTabId, documentIds: ["doc-stale"] },
        files: [HOST_CONTENT_SCRIPT_FILE],
      }),
    )
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
    const { injectHostContentIntoCurrentTabIframesAfterNodeTranslation } =
      await import("../iframe-injection")
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
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { tabId: currentTabId, frameIds: [2] },
          func: expect.any(Function),
          args: [SITE_CONTROL_URL_WINDOW_KEY, "https://example.com/frame-a"],
        }),
      ]),
    )
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { tabId: currentTabId, frameIds: [2] },
          files: [HOST_CONTENT_SCRIPT_FILE],
        }),
      ]),
    )
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { tabId: currentTabId, frameIds: [3] },
          func: expect.any(Function),
          args: [SITE_CONTROL_URL_WINDOW_KEY, "https://example.com/frame-b"],
        }),
      ]),
    )
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { tabId: currentTabId, frameIds: [3] },
          files: [HOST_CONTENT_SCRIPT_FILE],
        }),
      ]),
    )
  })

  it("respects site control during top-frame node activation iframe injection", async () => {
    const { injectHostContentIntoCurrentTabIframesAfterNodeTranslation } =
      await import("../iframe-injection")
    getLocalConfigMock.mockResolvedValue(
      createConfig({
        nodeTranslationEnabled: true,
        siteControl: {
          mode: "blacklist",
          blacklistPatterns: ["example.com"],
          whitelistPatterns: [],
        },
      }),
    )

    await injectHostContentIntoCurrentTabIframesAfterNodeTranslation(currentTabId)

    expect(executeScriptMock).not.toHaveBeenCalled()
  })

  it("does not enable late iframe injection after top-frame node activation", async () => {
    const { onCompleted } = await setupSubject()
    const { injectHostContentIntoCurrentTabIframesAfterNodeTranslation } =
      await import("../iframe-injection")
    storageGetItemMock.mockResolvedValue({ enabled: false })
    getLocalConfigMock.mockResolvedValue(createConfig({ nodeTranslationEnabled: true }))

    await injectHostContentIntoCurrentTabIframesAfterNodeTranslation(currentTabId)
    executeScriptMock.mockClear()
    getAllFramesMock.mockClear()

    await onCompleted(
      createDetails({
        frameId: 4,
        documentId: "doc-late",
        url: "https://example.com/late-frame",
      }),
    )

    expect(getAllFramesMock).not.toHaveBeenCalled()
    expect(executeScriptMock).not.toHaveBeenCalled()
  })
})
