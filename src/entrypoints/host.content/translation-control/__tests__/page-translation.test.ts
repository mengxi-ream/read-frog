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
  const managers: Array<{ isActive: boolean, stop: () => void }> = []

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
    managers.forEach((manager) => {
      if (manager.isActive) {
        manager.stop()
      }
    })
    managers.length = 0
    vi.unstubAllGlobals()
  })

  it("translates the current document title and restores it on stop", async () => {
    const { PageTranslationManager } = await import("../page-translation")
    const manager = new PageTranslationManager()
    managers.push(manager)

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
    managers.push(manager)

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

  it("does not enqueue duplicate title translations for unrelated head mutations while a request is pending", async () => {
    const pendingTranslation = createDeferred<string>()
    translateTextForPageMock.mockImplementation(() => pendingTranslation.promise)

    const { PageTranslationManager } = await import("../page-translation")
    const manager = new PageTranslationManager()
    managers.push(manager)

    await manager.start()

    expect(translateTextForPageMock).toHaveBeenCalledTimes(1)
    expect(translateTextForPageMock).toHaveBeenCalledWith("Original title")

    const meta = document.createElement("meta")
    meta.name = "description"
    meta.content = "unrelated"
    document.head.append(meta)

    await Promise.resolve()
    await Promise.resolve()

    expect(translateTextForPageMock).toHaveBeenCalledTimes(1)

    pendingTranslation.resolve("Original title translated")
    await vi.waitFor(() => {
      expect(document.title).toBe("Original title translated")
    })
  })

  it("does not retry the same source title on unrelated head mutations after a no-op title translation", async () => {
    translateTextForPageMock.mockResolvedValue("")

    const { PageTranslationManager } = await import("../page-translation")
    const manager = new PageTranslationManager()
    managers.push(manager)

    await manager.start()

    await Promise.resolve()
    await Promise.resolve()

    expect(document.title).toBe("Original title")
    expect(translateTextForPageMock).toHaveBeenCalledTimes(1)

    const meta = document.createElement("meta")
    meta.name = "keywords"
    meta.content = "still unrelated"
    document.head.append(meta)

    await Promise.resolve()
    await Promise.resolve()

    expect(translateTextForPageMock).toHaveBeenCalledTimes(1)
  })

  it("does not overwrite a newer page title when stopped during a pending title translation", async () => {
    const pendingTranslation = createDeferred<string>()
    translateTextForPageMock
      .mockResolvedValueOnce("Original title translated")
      .mockImplementationOnce(() => pendingTranslation.promise)

    const { PageTranslationManager } = await import("../page-translation")
    const manager = new PageTranslationManager()
    managers.push(manager)

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
