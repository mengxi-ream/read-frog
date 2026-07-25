// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getPageTranslationActionContext } from "@/utils/host/translate/translation-session"
import { PageTranslationManager } from "../page-translation"

const {
  mockDeepQueryTopLevelSelector,
  mockGetDetectedCodeFromStorage,
  mockGetLocalConfig,
  mockGetOrCreateWebPageContext,
  mockRemoveAllTranslatedWrapperNodes,
  mockSendMessage,
  mockTranslateTextForPageTitle,
  mockTranslateWalkedElement,
  mockValidateTranslationConfigAndToast,
  mockWalkAndLabelElement,
} = vi.hoisted(() => ({
  mockGetDetectedCodeFromStorage: vi.fn<(...args: any[]) => any>(),
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockDeepQueryTopLevelSelector: vi.fn<(...args: any[]) => any>(),
  mockWalkAndLabelElement: vi.fn<(...args: any[]) => any>(),
  mockRemoveAllTranslatedWrapperNodes: vi.fn<(...args: any[]) => any>(),
  mockTranslateWalkedElement: vi.fn<(...args: any[]) => any>(),
  mockTranslateTextForPageTitle: vi.fn<(...args: any[]) => any>(),
  mockGetOrCreateWebPageContext: vi.fn<(...args: any[]) => any>(),
  mockValidateTranslationConfigAndToast: vi.fn<(...args: any[]) => any>(),
  mockSendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/config/languages", () => ({
  getDetectedCodeFromStorage: mockGetDetectedCodeFromStorage,
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/host/dom/filter", () => ({
  hasNoWalkAncestor: vi.fn<(...args: any[]) => any>().mockReturnValue(false),
  isDontWalkIntoAndDontTranslateAsChildElement: vi
    .fn<(...args: any[]) => any>()
    .mockReturnValue(false),
  isDontWalkIntoButTranslateAsChildElement: vi.fn<(...args: any[]) => any>().mockReturnValue(false),
  isWalkBlockedElement: vi.fn<(...args: any[]) => any>().mockReturnValue(false),
  isHTMLElement: (node: unknown) => node instanceof HTMLElement,
}))

vi.mock("@/utils/host/dom/find", () => ({
  deepQueryTopLevelSelector: mockDeepQueryTopLevelSelector,
}))

vi.mock("@/utils/host/dom/traversal", () => ({
  walkAndLabelElement: mockWalkAndLabelElement,
  walkAndLabelElementChunked: vi
    .fn<(...args: any[]) => any>()
    .mockResolvedValue({ forceBlock: false, isInlineNode: false }),
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeAllTranslatedWrapperNodes: mockRemoveAllTranslatedWrapperNodes,
  translateWalkedElement: mockTranslateWalkedElement,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPageTitle: mockTranslateTextForPageTitle,
}))

vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: mockGetOrCreateWebPageContext,
}))

vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: mockValidateTranslationConfigAndToast,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn<(...args: any[]) => any>(),
    info: vi.fn<(...args: any[]) => any>(),
    warn: vi.fn<(...args: any[]) => any>(),
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mockSendMessage,
}))

class MockIntersectionObserver {
  observe = vi.fn<(...args: any[]) => any>()
  unobserve = vi.fn<(...args: any[]) => any>()
  disconnect = vi.fn<(...args: any[]) => any>()
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

async function flushDomUpdates(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

describe("pageTranslationManager title handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    document.head.innerHTML = ""
    document.body.innerHTML = "<main>Article body</main>"
    document.title = "Original Title"

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

    mockGetDetectedCodeFromStorage.mockResolvedValue("eng")
    mockGetLocalConfig.mockResolvedValue(DEFAULT_CONFIG)
    mockDeepQueryTopLevelSelector.mockReturnValue([])
    mockGetOrCreateWebPageContext.mockResolvedValue({
      url: window.location.href,
      webTitle: "Original Title",
      webContent: "Article body",
    })
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
    mockSendMessage.mockResolvedValue(undefined)
  })

  it("keeps automatic and context-free starts out of the prompt experiment", async () => {
    const automaticContexts = [
      undefined,
      createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.PAGE_AUTO),
    ]

    for (const analyticsContext of automaticContexts) {
      const manager = new PageTranslationManager()
      await manager.start(analyticsContext)

      expect(getPageTranslationActionContext()).toBeNull()

      manager.stop()
    }
  })

  it("creates a prompt experiment action for a manual page translation", async () => {
    const manager = new PageTranslationManager()
    await manager.start(
      createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP),
    )

    expect(getPageTranslationActionContext()).toEqual({
      actionId: expect.any(String),
      feature: ANALYTICS_FEATURE.PAGE_TRANSLATION,
      surface: ANALYTICS_SURFACE.POPUP,
    })

    manager.stop()
  })

  it("does not prime webpage context on start for non-llm translation", async () => {
    mockTranslateTextForPageTitle.mockResolvedValue("Translated Title")

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    expect(mockGetOrCreateWebPageContext).not.toHaveBeenCalled()

    manager.stop()
  })

  it("primes webpage context on start for AI-aware llm translation", async () => {
    mockGetLocalConfig.mockResolvedValue({
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        providerId: "openai-default",
        enableAIContentAware: true,
      },
    })
    mockTranslateTextForPageTitle.mockResolvedValue("Translated Title")

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    expect(mockGetOrCreateWebPageContext).toHaveBeenCalledTimes(1)

    manager.stop()
  })

  it("translates the tab title on start and restores the latest source title on stop", async () => {
    mockTranslateTextForPageTitle
      .mockResolvedValueOnce("Translated Title")
      .mockResolvedValueOnce("Translated Updated Title")

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    expect(document.title).toBe("Translated Title")
    expect(mockTranslateTextForPageTitle).toHaveBeenCalledTimes(1)
    expect(mockTranslateTextForPageTitle).toHaveBeenCalledWith("Original Title")

    document.title = "Updated Source Title"
    await flushDomUpdates()

    expect(mockTranslateTextForPageTitle).toHaveBeenCalledTimes(2)
    expect(mockTranslateTextForPageTitle).toHaveBeenLastCalledWith("Updated Source Title")
    expect(document.title).toBe("Translated Updated Title")

    manager.stop()

    expect(document.title).toBe("Updated Source Title")
    expect(mockSendMessage).toHaveBeenCalledWith(
      "setAndNotifyPageTranslationStateChangedByManager",
      {
        enabled: true,
        url: window.location.href,
      },
    )
    expect(mockSendMessage).toHaveBeenCalledWith(
      "setAndNotifyPageTranslationStateChangedByManager",
      {
        enabled: false,
        url: window.location.href,
      },
    )
  })

  it("does not retrigger title translation for its own managed title updates", async () => {
    mockTranslateTextForPageTitle.mockResolvedValue("Translated Title")

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()
    await flushDomUpdates()

    expect(document.title).toBe("Translated Title")
    expect(mockTranslateTextForPageTitle).toHaveBeenCalledTimes(1)

    manager.stop()
  })

  it("ignores stale translation results when the source title changes mid-request", async () => {
    const firstTranslation = createDeferred<string>()
    const secondTranslation = createDeferred<string>()

    mockTranslateTextForPageTitle
      .mockImplementationOnce(() => firstTranslation.promise)
      .mockImplementationOnce(() => secondTranslation.promise)

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    document.title = "Updated Source Title"
    await flushDomUpdates()

    expect(mockTranslateTextForPageTitle).toHaveBeenCalledTimes(2)

    firstTranslation.resolve("Stale Translation")
    await flushDomUpdates()

    expect(document.title).toBe("Updated Source Title")

    secondTranslation.resolve("Fresh Translation")
    await flushDomUpdates()

    expect(document.title).toBe("Fresh Translation")

    manager.stop()
    expect(document.title).toBe("Updated Source Title")
  })
})
