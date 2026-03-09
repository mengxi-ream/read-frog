// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  deepQueryTopLevelSelectorMock,
  getDetectedCodeFromStorageMock,
  getLocalConfigMock,
  hasNoWalkAncestorMock,
  removeAllTranslatedWrapperNodesMock,
  sendMessageMock,
  translateTextForPageMock,
  translateWalkedElementMock,
  validateTranslationConfigAndToastMock,
  walkAndLabelElementMock,
} = vi.hoisted(() => ({
  deepQueryTopLevelSelectorMock: vi.fn(),
  getDetectedCodeFromStorageMock: vi.fn(),
  getLocalConfigMock: vi.fn(),
  hasNoWalkAncestorMock: vi.fn(),
  removeAllTranslatedWrapperNodesMock: vi.fn(),
  sendMessageMock: vi.fn(),
  translateTextForPageMock: vi.fn(),
  translateWalkedElementMock: vi.fn(),
  validateTranslationConfigAndToastMock: vi.fn(),
  walkAndLabelElementMock: vi.fn(),
}))

vi.mock("@/utils/config/languages", () => ({
  getDetectedCodeFromStorage: getDetectedCodeFromStorageMock,
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: getLocalConfigMock,
}))

vi.mock("@/utils/host/dom/filter", () => ({
  hasNoWalkAncestor: hasNoWalkAncestorMock,
  isDontWalkIntoButTranslateAsChildElement: vi.fn(() => false),
  isHTMLElement: (value: unknown) => value instanceof HTMLElement,
}))

vi.mock("@/utils/host/dom/find", () => ({
  deepQueryTopLevelSelector: deepQueryTopLevelSelectorMock,
}))

vi.mock("@/utils/host/dom/traversal", () => ({
  walkAndLabelElement: walkAndLabelElementMock,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeAllTranslatedWrapperNodes: removeAllTranslatedWrapperNodesMock,
  translateWalkedElement: translateWalkedElementMock,
}))

vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: validateTranslationConfigAndToastMock,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: translateTextForPageMock,
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve,
    reject,
  }
}

describe("PageTranslationManager", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

    document.head.innerHTML = "<title>Original title</title>"
    document.body.innerHTML = "<main>Content</main>"
    history.replaceState({}, "", "/article")

    getLocalConfigMock.mockResolvedValue({} as Config)
    getDetectedCodeFromStorageMock.mockResolvedValue("eng")
    hasNoWalkAncestorMock.mockReturnValue(false)
    deepQueryTopLevelSelectorMock.mockReturnValue([])
    translateWalkedElementMock.mockResolvedValue(undefined)
    validateTranslationConfigAndToastMock.mockReturnValue(true)
    sendMessageMock.mockResolvedValue(undefined)
    translateTextForPageMock.mockImplementation(async (title: string) => `${title} translated`)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("translates the current document title and restores it on stop", async () => {
    const { PageTranslationManager } = await import("../page-translation")
    const manager = new PageTranslationManager()

    await manager.start()

    await vi.waitFor(() => {
      expect(document.title).toBe("Original title translated")
    })

    expect(translateTextForPageMock).toHaveBeenCalledWith("Original title")

    manager.stop()

    expect(document.title).toBe("Original title")
    expect(removeAllTranslatedWrapperNodesMock).toHaveBeenCalled()
  })

  it("re-translates the document title when the page updates it", async () => {
    const { PageTranslationManager } = await import("../page-translation")
    const manager = new PageTranslationManager()

    await manager.start()

    await vi.waitFor(() => {
      expect(document.title).toBe("Original title translated")
    })

    document.title = "Updated title"

    await vi.waitFor(() => {
      expect(translateTextForPageMock).toHaveBeenCalledWith("Updated title")
      expect(document.title).toBe("Updated title translated")
    })

    manager.stop()

    expect(document.title).toBe("Updated title")
  })

  it("does not overwrite a newer page title when stopped during a pending title translation", async () => {
    const pendingTranslation = createDeferred<string>()
    translateTextForPageMock
      .mockResolvedValueOnce("Original title translated")
      .mockImplementationOnce(() => pendingTranslation.promise)

    const { PageTranslationManager } = await import("../page-translation")
    const manager = new PageTranslationManager()

    await manager.start()

    await vi.waitFor(() => {
      expect(document.title).toBe("Original title translated")
    })

    document.title = "Route title"

    await vi.waitFor(() => {
      expect(translateTextForPageMock).toHaveBeenCalledWith("Route title")
    })

    manager.stop()

    expect(document.title).toBe("Route title")

    pendingTranslation.resolve("Route title translated")
    await Promise.resolve()
    await Promise.resolve()

    expect(document.title).toBe("Route title")
  })
})
