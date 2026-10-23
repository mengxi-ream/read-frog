// @vitest-environment jsdom

/**
 * Initial-scan coverage for walks rooted at document.documentElement (#1991).
 *
 * Unlike page-translation-mutations.test.ts, these tests run the REAL
 * traversal and filter modules: the failure mode they pin down — an
 * inline-level sibling of <body> making <html> itself a paragraph, which
 * collapses the whole document into ONE observed unit — is invisible to any
 * test that mocks walkAndLabelElement. Only translation side effects and
 * infrastructure are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { PageTranslationManager } from "../page-translation"

const {
  mockGetRandomUUID,
  mockGetLocalConfig,
  mockGetOrCreateWebPageContext,
  mockRemoveAllTranslatedWrapperNodes,
  mockSendMessage,
  mockTranslateTextForPageTitle,
  mockTranslateNodesBilingualMode,
  mockTranslateWalkedElement,
  mockValidateTranslationConfigAndToast,
} = vi.hoisted(() => ({
  mockGetRandomUUID: vi.fn<(...args: any[]) => any>(),
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockGetOrCreateWebPageContext: vi.fn<(...args: any[]) => any>(),
  mockRemoveAllTranslatedWrapperNodes: vi.fn<(...args: any[]) => any>(),
  mockSendMessage: vi.fn<(...args: any[]) => any>(),
  mockTranslateTextForPageTitle: vi.fn<(...args: any[]) => any>(),
  mockTranslateNodesBilingualMode: vi.fn<(...args: any[]) => any>(),
  mockTranslateWalkedElement: vi.fn<(...args: any[]) => any>(),
  mockValidateTranslationConfigAndToast: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/config/storage", () => ({ getLocalConfig: mockGetLocalConfig }))
vi.mock("@/utils/crypto-polyfill", () => ({ getRandomUUID: mockGetRandomUUID }))
vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeAllTranslatedWrapperNodes: mockRemoveAllTranslatedWrapperNodes,
  translateNodes: vi.fn<(...args: any[]) => any>(),
  translateNodesBilingualMode: mockTranslateNodesBilingualMode,
  translateWalkedElement: mockTranslateWalkedElement,
}))
vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: mockValidateTranslationConfigAndToast,
}))
vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPageTitle: mockTranslateTextForPageTitle,
}))
vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: mockGetOrCreateWebPageContext,
}))
vi.mock("@/utils/message", () => ({ sendMessage: mockSendMessage }))

const observedTargets: Element[] = []

class MockIntersectionObserver {
  observe = vi.fn<(...args: any[]) => any>((target: Element) => {
    observedTargets.push(target)
  })

  unobserve = vi.fn<(...args: any[]) => any>()
  disconnect = vi.fn<(...args: any[]) => any>()
}

function labelOf(el: Element): string {
  return el.id ? `${el.tagName.toLowerCase()}#${el.id}` : el.tagName.toLowerCase()
}

function resetDocumentElementLabels(): void {
  for (const attr of [WALKED_ATTRIBUTE, PARAGRAPH_ATTRIBUTE, BLOCK_ATTRIBUTE, INLINE_ATTRIBUTE]) {
    document.documentElement.removeAttribute(attr)
  }
}

describe("initial scan rooted at documentElement (real traversal)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    observedTargets.length = 0
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    document.title = ""
    resetDocumentElementLabels()

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

    mockGetRandomUUID.mockReturnValue("walk-id")
    mockGetLocalConfig.mockResolvedValue(DEFAULT_CONFIG)
    mockGetOrCreateWebPageContext.mockResolvedValue({ url: "", webTitle: "", webContent: "" })
    mockTranslateTextForPageTitle.mockResolvedValue("")
    mockTranslateNodesBilingualMode.mockResolvedValue(undefined)
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
    mockSendMessage.mockResolvedValue(undefined)
  })

  it("observes body paragraphs individually on an ordinary page", async () => {
    document.body.innerHTML = `
      <div><p id="p1">Hello world</p></div>
      <div><p id="p2">Second paragraph</p></div>
    `

    const manager = new PageTranslationManager()
    try {
      await manager.start()

      expect(observedTargets.map(labelOf)).toEqual(["p#p1", "p#p2"])
      expect(document.documentElement).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
    } finally {
      if (manager.isActive) manager.stop()
    }
  })

  it("never collapses the document into one unit when an unstyled reader root sits beside body", async () => {
    // Unstyled custom elements default to display:inline. Without the
    // traversal's document-root guard this labels <html> as a paragraph, and
    // the initial scan then observes ONLY <html>: viewport gating dies and the
    // translated-region querySelector guard matches document-wide.
    document.body.innerHTML = `<div><p id="p1">Hello world</p></div>`
    const readerRoot = document.createElement("sr-read")
    readerRoot.innerHTML = `
      <sr-rd-content>
        <p id="rp1">Reader mode content</p>
        <p id="rp2">More reader text</p>
      </sr-rd-content>
    `
    document.documentElement.append(readerRoot)

    const manager = new PageTranslationManager()
    try {
      await manager.start()

      expect(document.documentElement).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
      expect(observedTargets).not.toContain(document.documentElement)
      // Body content and the inline reader tree are separate observed units;
      // the reader tree is one unit because its root is display:inline.
      expect(observedTargets.map(labelOf)).toEqual(["p#p1", "sr-read"])
    } finally {
      if (manager.isActive) manager.stop()
      readerRoot.remove()
    }
  })

  it("observes reader paragraphs individually when the reader root is block-level (real SimpRead)", async () => {
    // SimpRead's stylesheet sets sr-read { display: flex }, and its 2.3.x DOM
    // wraps the reader root in a plain <div> beside <body>.
    document.body.innerHTML = `<div><p id="p1">Hello world</p></div>`
    const style = document.createElement("style")
    style.textContent = "sr-read { display: flex } sr-rd-content { display: block }"
    document.head.append(style)
    const wrapper = document.createElement("div")
    const readerRoot = document.createElement("sr-read")
    readerRoot.innerHTML = `
      <sr-rd-content>
        <p id="rp1">Reader mode content</p>
        <p id="rp2">More reader text</p>
      </sr-rd-content>
    `
    wrapper.append(readerRoot)
    document.documentElement.append(wrapper)

    const manager = new PageTranslationManager()
    try {
      await manager.start()

      expect(document.documentElement).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
      expect(observedTargets.map(labelOf)).toEqual(["p#p1", "p#rp1", "p#rp2"])
    } finally {
      if (manager.isActive) manager.stop()
      wrapper.remove()
    }
  })

  it("still observes new content when a translated wrapper already exists in the page", async () => {
    // Regression guard for the collapse's worst symptom: with <html> as the
    // only observed unit, translateWalkedElement's wrapper querySelector
    // becomes a document-wide match and silently skips the entire page.
    document.body.innerHTML = `
      <div>
        <p id="p1">Hello world</p>
        <div class="read-frog-translated-content-wrapper notranslate">已翻译</div>
      </div>
    `
    const readerRoot = document.createElement("sr-read")
    readerRoot.innerHTML = `<sr-rd-content><p id="rp1">Reader mode content</p></sr-rd-content>`
    document.documentElement.append(readerRoot)

    const manager = new PageTranslationManager()
    try {
      await manager.start()

      expect(observedTargets).not.toContain(document.documentElement)
      expect(observedTargets.map(labelOf)).toContain("p#p1")
      expect(observedTargets.map(labelOf)).toContain("sr-read")
    } finally {
      if (manager.isActive) manager.stop()
      readerRoot.remove()
    }
  })

  it("translates a bare inline element injected beside body via its own paragraph label", async () => {
    document.body.innerHTML = `<div><p id="p1">Hello world</p></div>`
    const injected = document.createElement("span")
    injected.id = "injected"
    injected.textContent = "injected text"
    document.documentElement.append(injected)

    const manager = new PageTranslationManager()
    try {
      await manager.start()

      expect(document.documentElement).not.toHaveAttribute(PARAGRAPH_ATTRIBUTE)
      expect(observedTargets.map(labelOf)).toEqual(["p#p1", "span#injected"])
    } finally {
      if (manager.isActive) manager.stop()
      injected.remove()
    }
  })
})
