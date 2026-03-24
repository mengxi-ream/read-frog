// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PageTranslationManager } from "../page-translation"

const {
  mockDeepQueryTopLevelSelector,
  mockGetDetectedCodeFromStorage,
  mockGetLocalConfig,
  mockGetOrFetchArticleData,
  mockGetRandomUUID,
  mockRemoveAllTranslatedWrapperNodes,
  mockSendMessage,
  mockTranslateTextForPageTitle,
  mockTranslateWalkedElement,
  mockValidateTranslationConfigAndToast,
  mockWalkAndLabelElement,
} = vi.hoisted(() => ({
  mockGetDetectedCodeFromStorage: vi.fn(),
  mockGetLocalConfig: vi.fn(),
  mockDeepQueryTopLevelSelector: vi.fn(),
  mockWalkAndLabelElement: vi.fn(),
  mockRemoveAllTranslatedWrapperNodes: vi.fn(),
  mockTranslateWalkedElement: vi.fn(),
  mockTranslateTextForPageTitle: vi.fn(),
  mockGetOrFetchArticleData: vi.fn(),
  mockValidateTranslationConfigAndToast: vi.fn(),
  mockSendMessage: vi.fn(),
  mockGetRandomUUID: vi.fn(),
}))

vi.mock("@/utils/config/languages", () => ({
  getDetectedCodeFromStorage: mockGetDetectedCodeFromStorage,
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/constants/dom-labels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants/dom-labels")>()

  return actual
})

vi.mock("@/utils/crypto-polyfill", () => ({
  getRandomUUID: mockGetRandomUUID,
}))

vi.mock("@/utils/host/dom/filter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/host/dom/filter")>()

  return {
    ...actual,
    hasNoWalkAncestor: vi.fn().mockReturnValue(false),
    isDontWalkIntoButTranslateAsChildElement: vi.fn().mockReturnValue(false),
  }
})

vi.mock("@/utils/host/dom/find", () => ({
  deepQueryTopLevelSelector: mockDeepQueryTopLevelSelector,
}))

vi.mock("@/utils/host/dom/traversal", () => ({
  walkAndLabelElement: mockWalkAndLabelElement,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeAllTranslatedWrapperNodes: mockRemoveAllTranslatedWrapperNodes,
  translateWalkedElement: mockTranslateWalkedElement,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPageTitle: mockTranslateTextForPageTitle,
}))

vi.mock("@/utils/host/translate/article-context", () => ({
  getOrFetchArticleData: mockGetOrFetchArticleData,
}))

vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: mockValidateTranslationConfigAndToast,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: mockSendMessage,
}))

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    MockIntersectionObserver.instances.push(this)
  }
}

async function flushDomUpdates(): Promise<void> {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  await Promise.resolve()
}

function labelParagraphs(element: HTMLElement, walkId: string): void {
  if (element.matches("p")) {
    element.setAttribute("data-read-frog-paragraph", "")
    element.setAttribute("data-read-frog-walked", walkId)
  }

  element.querySelectorAll<HTMLElement>("p").forEach((paragraph) => {
    paragraph.setAttribute("data-read-frog-paragraph", "")
    paragraph.setAttribute("data-read-frog-walked", walkId)
  })
}

describe("pageTranslationManager mutation handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockIntersectionObserver.instances = []

    document.head.innerHTML = ""
    document.body.innerHTML = `
      <main>
        <div id="card">
          <p id="question">Question one</p>
        </div>
      </main>
    `
    document.title = ""

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

    mockGetDetectedCodeFromStorage.mockResolvedValue("eng")
    mockGetLocalConfig.mockResolvedValue(DEFAULT_CONFIG)
    mockDeepQueryTopLevelSelector.mockReturnValue([])
    mockGetOrFetchArticleData.mockResolvedValue({ title: "Question one" })
    mockGetRandomUUID.mockReturnValue("walk-id")
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
    mockSendMessage.mockResolvedValue(undefined)
    mockWalkAndLabelElement.mockImplementation((element: HTMLElement, walkId: string) => {
      labelParagraphs(element, walkId)
      return { forceBlock: false, isInlineNode: false }
    })
  })

  it("re-observes the nearest paragraph for text-node-only childList updates without duplicate work", async () => {
    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const question = document.getElementById("question")
    const intersectionObserver = MockIntersectionObserver.instances[0]

    expect(question).toBeInstanceOf(HTMLElement)
    expect(intersectionObserver).toBeDefined()

    mockWalkAndLabelElement.mockClear()
    intersectionObserver!.observe.mockClear()

    question!.replaceChildren(
      document.createTextNode("Question two"),
      document.createTextNode(" updated"),
    )
    await flushDomUpdates()

    expect(mockWalkAndLabelElement).toHaveBeenCalledTimes(1)
    expect(mockWalkAndLabelElement).toHaveBeenCalledWith(question, "walk-id", DEFAULT_CONFIG)
    expect(intersectionObserver!.observe).toHaveBeenCalledTimes(1)
    expect(intersectionObserver!.observe).toHaveBeenCalledWith(question)

    manager.stop()
  })

  it("re-observes the nearest paragraph when existing text nodes change in place", async () => {
    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const question = document.getElementById("question")
    const textNode = question?.firstChild
    const intersectionObserver = MockIntersectionObserver.instances[0]

    expect(question).toBeInstanceOf(HTMLElement)
    expect(textNode?.nodeType).toBe(Node.TEXT_NODE)
    expect(intersectionObserver).toBeDefined()

    mockWalkAndLabelElement.mockClear()
    intersectionObserver!.observe.mockClear()

    textNode!.textContent = "Question three"
    await flushDomUpdates()

    expect(mockWalkAndLabelElement).toHaveBeenCalledTimes(1)
    expect(mockWalkAndLabelElement).toHaveBeenCalledWith(question, "walk-id", DEFAULT_CONFIG)
    expect(intersectionObserver!.observe).toHaveBeenCalledTimes(1)
    expect(intersectionObserver!.observe).toHaveBeenCalledWith(question)

    manager.stop()
  })
})
