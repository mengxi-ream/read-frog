// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  markExtensionDrivenNodeRemoval,
  registerBilingualTranslationState,
  unregisterBilingualTranslationState,
  type BilingualTranslationState,
} from "@/utils/host/translate/core/translation-state"
import { PageTranslationManager } from "../page-translation"

const {
  mockDeepQueryTopLevelSelector,
  mockGetDetectedCodeFromStorage,
  mockGetRandomUUID,
  mockGetLocalConfig,
  mockGetOrCreateWebPageContext,
  mockHasNoWalkAncestor,
  mockIsDontWalkIntoAndDontTranslateAsChildElement,
  mockIsDontWalkIntoButTranslateAsChildElement,
  mockRemoveAllTranslatedWrapperNodes,
  mockSendMessage,
  mockTranslateTextForPageTitle,
  mockTranslateNodesBilingualMode,
  mockTranslateWalkedElement,
  mockValidateTranslationConfigAndToast,
  mockWalkAndLabelElement,
  mockWalkAndLabelElementChunked,
} = vi.hoisted(() => ({
  mockGetDetectedCodeFromStorage: vi.fn<(...args: any[]) => any>(),
  mockGetRandomUUID: vi.fn<(...args: any[]) => any>(),
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockGetOrCreateWebPageContext: vi.fn<(...args: any[]) => any>(),
  mockDeepQueryTopLevelSelector: vi.fn<(...args: any[]) => any>(),
  mockHasNoWalkAncestor: vi.fn<(...args: any[]) => any>(),
  mockIsDontWalkIntoAndDontTranslateAsChildElement: vi.fn<(...args: any[]) => any>(),
  mockIsDontWalkIntoButTranslateAsChildElement: vi.fn<(...args: any[]) => any>(),
  mockWalkAndLabelElement: vi.fn<(...args: any[]) => any>(),
  mockWalkAndLabelElementChunked: vi.fn<(...args: any[]) => any>(),
  mockRemoveAllTranslatedWrapperNodes: vi.fn<(...args: any[]) => any>(),
  mockTranslateWalkedElement: vi.fn<(...args: any[]) => any>(),
  mockTranslateTextForPageTitle: vi.fn<(...args: any[]) => any>(),
  mockTranslateNodesBilingualMode: vi.fn<(...args: any[]) => any>(),
  mockValidateTranslationConfigAndToast: vi.fn<(...args: any[]) => any>(),
  mockSendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/config/languages", () => ({
  getDetectedCodeFromStorage: mockGetDetectedCodeFromStorage,
}))

vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: mockGetLocalConfig,
}))

vi.mock("@/utils/crypto-polyfill", () => ({
  getRandomUUID: mockGetRandomUUID,
}))

vi.mock("@/utils/host/dom/filter", () => ({
  hasNoWalkAncestor: mockHasNoWalkAncestor,
  isDontWalkIntoAndDontTranslateAsChildElement: mockIsDontWalkIntoAndDontTranslateAsChildElement,
  isDontWalkIntoButTranslateAsChildElement: mockIsDontWalkIntoButTranslateAsChildElement,
  isWalkBlockedElement: (element: HTMLElement, config: unknown) =>
    mockIsDontWalkIntoButTranslateAsChildElement(element, config) ||
    mockIsDontWalkIntoAndDontTranslateAsChildElement(element, config),
  isHTMLElement: (node: unknown) => node instanceof HTMLElement,
  isTranslatedWrapperNode: (node: unknown) =>
    node instanceof HTMLElement && node.classList.contains("read-frog-translated-content-wrapper"),
}))

vi.mock("@/utils/host/dom/find", () => ({
  deepQueryTopLevelSelector: mockDeepQueryTopLevelSelector,
}))

vi.mock("@/utils/host/dom/traversal", () => ({
  walkAndLabelElement: mockWalkAndLabelElement,
  walkAndLabelElementChunked: mockWalkAndLabelElementChunked,
}))

vi.mock("@/utils/host/translate/node-manipulation", () => ({
  removeAllTranslatedWrapperNodes: mockRemoveAllTranslatedWrapperNodes,
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

const intersectionObservers: MockIntersectionObserver[] = []

class MockIntersectionObserver {
  observe = vi.fn<(...args: any[]) => any>((target: Element) => {
    this.targets.add(target)
  })

  unobserve = vi.fn<(...args: any[]) => any>((target: Element) => {
    this.targets.delete(target)
  })

  disconnect = vi.fn<(...args: any[]) => any>(() => {
    this.targets.clear()
  })

  private readonly targets = new Set<Element>()

  constructor(
    private readonly callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {
    intersectionObservers.push(this)
  }

  async triggerIntersect(target: Element): Promise<void> {
    this.callback(
      [
        {
          isIntersecting: true,
          target,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    )
  }
}

async function flushDomUpdates(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

function deepQueryTopLevelSelectorImpl(
  root: Document | ShadowRoot | HTMLElement,
  selectorFn: (element: HTMLElement) => boolean,
): HTMLElement[] {
  if (root instanceof Document) {
    return root.body ? deepQueryTopLevelSelectorImpl(root.body, selectorFn) : []
  }

  if (root instanceof HTMLElement && selectorFn(root)) {
    return [root]
  }

  const result: HTMLElement[] = []

  if (root instanceof HTMLElement && root.shadowRoot) {
    result.push(...deepQueryTopLevelSelectorImpl(root.shadowRoot, selectorFn))
  }

  for (const child of root.children) {
    if (child instanceof HTMLElement) {
      result.push(...deepQueryTopLevelSelectorImpl(child, selectorFn))
    }
  }

  return result
}

function isBlockedForTraversal(element: HTMLElement): boolean {
  return (
    Boolean(element.hidden) ||
    element.matches("[data-site-rule-blocked][aria-hidden='true']") ||
    element.classList.contains("closed")
  )
}

function walkAndLabelVisibleParagraphs(
  element: HTMLElement,
  walkId: string,
  onBlockedElement?: (blocked: HTMLElement) => void,
) {
  if (isBlockedForTraversal(element)) {
    onBlockedElement?.(element)
    return {
      forceBlock: false,
      isInlineNode: false,
    }
  }

  element.setAttribute("data-read-frog-walked", walkId)

  for (const child of element.children) {
    if (child instanceof HTMLElement) {
      walkAndLabelVisibleParagraphs(child, walkId, onBlockedElement)
    }
  }

  if (element.tagName === "P" && element.textContent?.trim()) {
    element.setAttribute("data-read-frog-paragraph", "")
  }

  return {
    forceBlock: false,
    isInlineNode: false,
  }
}

describe("pageTranslationManager mutation re-walk", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    intersectionObservers.length = 0

    document.head.innerHTML = ""
    document.body.innerHTML = ""
    document.title = ""

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

    mockGetDetectedCodeFromStorage.mockResolvedValue("eng")
    mockGetRandomUUID.mockReset().mockReturnValue("walk-id")
    mockGetLocalConfig.mockResolvedValue(DEFAULT_CONFIG)
    mockGetOrCreateWebPageContext.mockResolvedValue({
      url: window.location.href,
      webTitle: "",
      webContent: "",
    })
    mockHasNoWalkAncestor.mockReturnValue(false)
    mockIsDontWalkIntoButTranslateAsChildElement.mockReturnValue(false)
    mockIsDontWalkIntoAndDontTranslateAsChildElement.mockImplementation((element: HTMLElement) =>
      isBlockedForTraversal(element),
    )
    mockDeepQueryTopLevelSelector.mockImplementation(deepQueryTopLevelSelectorImpl)
    mockWalkAndLabelElement.mockImplementation(
      (
        element: HTMLElement,
        walkId: string,
        _config: unknown,
        callbacks?: { onBlockedElement?: (blocked: HTMLElement) => void },
      ) => walkAndLabelVisibleParagraphs(element, walkId, callbacks?.onBlockedElement),
    )
    mockWalkAndLabelElementChunked.mockImplementation(
      async (
        element: HTMLElement,
        walkId: string,
        _config: unknown,
        options?: { onBlockedElement?: (blocked: HTMLElement) => void },
      ) => walkAndLabelVisibleParagraphs(element, walkId, options?.onBlockedElement),
    )
    mockTranslateTextForPageTitle.mockResolvedValue("")
    mockTranslateNodesBilingualMode.mockReset().mockResolvedValue(undefined)
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
    mockSendMessage.mockResolvedValue(undefined)
  })

  it("observes and translates hidden accordion content after it becomes visible", async () => {
    document.body.innerHTML = `
      <section id="accordion" hidden>
        <p id="panel">Accordion body</p>
      </section>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    const accordion = document.getElementById("accordion") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(observer.observe).not.toHaveBeenCalled()

    accordion.removeAttribute("hidden")
    await flushDomUpdates()

    expect(observer.observe).toHaveBeenCalledWith(panel)

    await observer.triggerIntersect(panel)
    await flushDomUpdates()

    expect(mockTranslateWalkedElement).toHaveBeenCalledWith(
      panel,
      "walk-id",
      DEFAULT_CONFIG,
      false,
      expect.anything(),
      expect.anything(),
    )

    manager.stop()
  })

  it("observes and translates aria-hidden content after a site-rule block becomes walkable", async () => {
    document.body.innerHTML = `
      <section id="accordion" data-site-rule-blocked aria-hidden="true">
        <p id="panel">Accordion body</p>
      </section>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    const accordion = document.getElementById("accordion") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(observer.observe).not.toHaveBeenCalled()

    accordion.setAttribute("aria-hidden", "false")
    await flushDomUpdates()

    expect(observer.observe).toHaveBeenCalledWith(panel)

    await observer.triggerIntersect(panel)
    await flushDomUpdates()

    expect(mockTranslateWalkedElement).toHaveBeenCalledWith(
      panel,
      "walk-id",
      DEFAULT_CONFIG,
      false,
      expect.anything(),
      expect.anything(),
    )

    manager.stop()
  })

  it("keeps style/class based re-walk behavior for existing hidden panels", async () => {
    document.body.innerHTML = `
      <section id="accordion" class="closed">
        <p id="panel">Accordion body</p>
      </section>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    const accordion = document.getElementById("accordion") as HTMLElement
    const panel = document.getElementById("panel") as HTMLElement

    expect(observer.observe).not.toHaveBeenCalled()

    accordion.classList.remove("closed")
    await flushDomUpdates()

    expect(observer.observe).toHaveBeenCalledWith(panel)

    await observer.triggerIntersect(panel)
    await flushDomUpdates()

    expect(mockTranslateWalkedElement).toHaveBeenCalledWith(
      panel,
      "walk-id",
      DEFAULT_CONFIG,
      false,
      expect.anything(),
      expect.anything(),
    )

    manager.stop()
  })

  it("retranslates an existing logical source after its text expands in place", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">Truncated tweet</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const source = document.getElementById("source")!.firstChild as Text
    const wrapper = document.createElement("span")
    wrapper.className = "read-frog-translated-content-wrapper"
    wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
    tweet.append(wrapper)
    const state: BilingualTranslationState = {
      layoutSource: tweet,
      sourceTextContent: "Truncated tweet",
      status: "active",
      walkId: "walk-id",
      wrapper,
      wrapperTextContent: null,
    }
    registerBilingualTranslationState(state)
    mockTranslateNodesBilingualMode.mockImplementation(async () => {
      unregisterBilingualTranslationState(state)
    })
    await flushDomUpdates()
    mockTranslateNodesBilingualMode.mockClear()

    source.data = "Expanded tweet content"
    await flushDomUpdates()

    expect(mockWalkAndLabelElement).toHaveBeenCalledWith(tweet, "walk-id", DEFAULT_CONFIG)
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledWith([tweet], "walk-id", DEFAULT_CONFIG)

    unregisterBilingualTranslationState(state)
    manager.stop()
  })

  it("runs another refresh when the source changes during a pending retranslation", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">Initial tweet</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const source = document.getElementById("source")!.firstChild as Text
    const createState = (): BilingualTranslationState => {
      const wrapper = document.createElement("span")
      wrapper.className = "read-frog-translated-content-wrapper"
      wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
      const state: BilingualTranslationState = {
        layoutSource: tweet,
        sourceTextContent: source.data,
        status: "active",
        walkId: "walk-id",
        wrapper,
        wrapperTextContent: null,
      }
      tweet.append(wrapper)
      registerBilingualTranslationState(state)
      return state
    }

    let activeState = createState()
    let resolveFirstRefresh!: () => void
    const firstRefresh = new Promise<void>((resolve) => {
      resolveFirstRefresh = resolve
    })
    mockTranslateNodesBilingualMode.mockImplementation(async () => {
      unregisterBilingualTranslationState(activeState)
      activeState.wrapper?.remove()
      if (mockTranslateNodesBilingualMode.mock.calls.length === 1) {
        activeState = createState()
        await firstRefresh
      }
    })
    await flushDomUpdates()
    mockTranslateNodesBilingualMode.mockClear()

    source.data = "Expanded once"
    await flushDomUpdates()
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(1)

    source.data = "Expanded twice"
    await flushDomUpdates()
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(1)

    resolveFirstRefresh()
    await flushDomUpdates()
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(2)

    unregisterBilingualTranslationState(activeState)
    manager.stop()
  })

  it("does not let a deferred refresh from an old session touch the restarted session", async () => {
    mockGetRandomUUID.mockReturnValueOnce("old-walk").mockReturnValueOnce("new-walk")
    document.body.innerHTML = `
      <p id="tweet"><span id="source">Initial tweet</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const source = document.getElementById("source")!.firstChild as Text
    const createState = (walkId: string): BilingualTranslationState => {
      const wrapper = document.createElement("span")
      wrapper.className = "read-frog-translated-content-wrapper"
      wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
      const state: BilingualTranslationState = {
        layoutSource: tweet,
        sourceTextContent: source.data,
        status: "active",
        walkId,
        wrapper,
        wrapperTextContent: null,
      }
      tweet.append(wrapper)
      registerBilingualTranslationState(state)
      return state
    }

    let resolveOldRefresh!: () => void
    let resolveNewRefresh!: () => void
    const oldRefresh = new Promise<void>((resolve) => {
      resolveOldRefresh = resolve
    })
    const newRefresh = new Promise<void>((resolve) => {
      resolveNewRefresh = resolve
    })
    let activeOldState: BilingualTranslationState | undefined
    let activeNewState: BilingualTranslationState | undefined
    let newWalkCalls = 0
    mockTranslateNodesBilingualMode.mockImplementation(async (_nodes, walkId) => {
      if (walkId === "old-walk") {
        if (activeOldState) {
          unregisterBilingualTranslationState(activeOldState)
          activeOldState.wrapper?.remove()
          activeOldState = undefined
        }
        await oldRefresh
      } else if (walkId === "new-walk") {
        if (activeNewState) {
          unregisterBilingualTranslationState(activeNewState)
          activeNewState.wrapper?.remove()
        }
        activeNewState = createState("new-walk")
        newWalkCalls += 1
        if (newWalkCalls === 1) await newRefresh
      }
    })

    activeOldState = createState("old-walk")
    await flushDomUpdates()
    mockTranslateNodesBilingualMode.mockClear()
    source.data = "Old session mutation"
    await flushDomUpdates()
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(1)

    manager.stop()
    await manager.start()
    await flushDomUpdates()

    activeNewState = createState("new-walk")
    source.data = "New session mutation one"
    await flushDomUpdates()
    source.data = "New session mutation two"
    await flushDomUpdates()
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(2)

    resolveOldRefresh()
    await flushDomUpdates()
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(2)

    resolveNewRefresh()
    await flushDomUpdates()
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(3)
    expect(mockTranslateNodesBilingualMode.mock.calls.map((call) => call[1])).toEqual([
      "old-walk",
      "new-walk",
      "new-walk",
    ])

    if (activeNewState) {
      unregisterBilingualTranslationState(activeNewState)
      activeNewState.wrapper?.remove()
    }
    manager.stop()
  })

  it("ignores the extension's own wrapper and error-host insertions (#1831)", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">Original tweet</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const wrapper = document.createElement("span")
    wrapper.className = "notranslate read-frog-translated-content-wrapper"
    wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
    tweet.append(wrapper)
    const state: BilingualTranslationState = {
      layoutSource: tweet,
      sourceTextContent: "Original tweet",
      status: "active",
      walkId: "walk-id",
      wrapper,
      wrapperTextContent: null,
    }
    registerBilingualTranslationState(state)
    await flushDomUpdates()
    mockWalkAndLabelElement.mockClear()
    mockTranslateNodesBilingualMode.mockClear()

    // Everything the extension inserts during a translation pass: translated
    // text inside the wrapper, an error shadow host, and a sibling wrapper.
    wrapper.append("译文文本")
    const errorHost = document.createElement("div")
    errorHost.className = "read-frog-react-shadow-host"
    wrapper.append(errorHost)
    const siblingWrapper = document.createElement("span")
    siblingWrapper.className = "notranslate read-frog-translated-content-wrapper"
    tweet.append(siblingWrapper)
    await flushDomUpdates()

    expect(mockWalkAndLabelElement).not.toHaveBeenCalled()
    expect(mockTranslateNodesBilingualMode).not.toHaveBeenCalled()

    unregisterBilingualTranslationState(state)
    manager.stop()
  })

  it("retranslates exactly once when the site re-renders a node containing our wrapper (#1831)", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">Original content</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const createState = (sourceText: string): BilingualTranslationState => {
      const wrapper = document.createElement("span")
      wrapper.className = "notranslate read-frog-translated-content-wrapper"
      wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
      wrapper.append(`${sourceText} 的译文`)
      tweet.append(wrapper)
      const state: BilingualTranslationState = {
        layoutSource: tweet,
        sourceTextContent: sourceText,
        status: "active",
        walkId: "walk-id",
        wrapper,
        wrapperTextContent: null,
      }
      registerBilingualTranslationState(state)
      return state
    }

    let activeState = createState("Original content")
    await flushDomUpdates()
    mockTranslateNodesBilingualMode.mockClear()
    mockTranslateNodesBilingualMode.mockImplementation(async () => {
      // The real translation dance: tear down the stale generation, insert a
      // fresh wrapper, re-register state for the current host text.
      unregisterBilingualTranslationState(activeState)
      if (activeState.wrapper) {
        markExtensionDrivenNodeRemoval(activeState.wrapper)
        activeState.wrapper.remove()
      }
      activeState = createState("Re-rendered content")
    })

    // Site re-render: replace the source span wholesale (framework-style).
    const oldSpan = document.getElementById("source") as HTMLElement
    const newSpan = document.createElement("span")
    newSpan.id = "source"
    newSpan.textContent = "Re-rendered content"
    tweet.replaceChild(newSpan, oldSpan)
    await flushDomUpdates()
    await flushDomUpdates()
    await flushDomUpdates()

    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll(".read-frog-translated-content-wrapper").length).toBe(1)

    unregisterBilingualTranslationState(activeState)
    manager.stop()
  })

  it("still retranslates once when the site removes our wrapper (#1831)", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">Original content</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const wrapper = document.createElement("span")
    wrapper.className = "notranslate read-frog-translated-content-wrapper"
    wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
    wrapper.append("译文文本")
    tweet.append(wrapper)
    const state: BilingualTranslationState = {
      layoutSource: tweet,
      sourceTextContent: "Original content",
      status: "active",
      walkId: "walk-id",
      wrapper,
      wrapperTextContent: null,
    }
    registerBilingualTranslationState(state)
    await flushDomUpdates()
    mockTranslateNodesBilingualMode.mockClear()
    mockTranslateNodesBilingualMode.mockImplementation(async () => {
      unregisterBilingualTranslationState(state)
    })

    // Site-driven removal — NOT marked as extension-initiated.
    wrapper.remove()
    await flushDomUpdates()

    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(1)
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledWith([tweet], "walk-id", DEFAULT_CONFIG)

    manager.stop()
  })

  it("retranslates when the site rewrites text inside our wrapper (#1918)", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">English title</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const wrapper = document.createElement("span")
    wrapper.className = "notranslate read-frog-translated-content-wrapper"
    wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
    wrapper.append("中文译文")
    tweet.append(wrapper)
    const state: BilingualTranslationState = {
      layoutSource: tweet,
      sourceTextContent: "English title",
      status: "active",
      walkId: "walk-id",
      wrapper,
      wrapperTextContent: wrapper.textContent,
    }
    registerBilingualTranslationState(state)
    await flushDomUpdates()
    mockTranslateNodesBilingualMode.mockClear()
    mockTranslateNodesBilingualMode.mockImplementation(async () => {
      unregisterBilingualTranslationState(state)
    })

    // CNBC-style truncation script: a characterData write on the text node
    // INSIDE our wrapper, replacing the translation with clipped English.
    const translatedTextNode = wrapper.firstChild as Text
    translatedTextNode.data = "English title…"
    await flushDomUpdates()

    expect(mockWalkAndLabelElement).toHaveBeenCalledWith(tweet, "walk-id", DEFAULT_CONFIG)
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(1)
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledWith([tweet], "walk-id", DEFAULT_CONFIG)

    manager.stop()
  })

  it("retranslates when the site replaces our translated node inside the wrapper (#1918)", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">English title</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const wrapper = document.createElement("span")
    wrapper.className = "notranslate read-frog-translated-content-wrapper"
    wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
    wrapper.append("中文译文")
    tweet.append(wrapper)
    const state: BilingualTranslationState = {
      layoutSource: tweet,
      sourceTextContent: "English title",
      status: "active",
      walkId: "walk-id",
      wrapper,
      wrapperTextContent: wrapper.textContent,
    }
    registerBilingualTranslationState(state)
    await flushDomUpdates()
    mockTranslateNodesBilingualMode.mockClear()
    mockTranslateNodesBilingualMode.mockImplementation(async () => {
      unregisterBilingualTranslationState(state)
    })

    // Framework-style childList tamper: our text node swapped for a site span.
    const siteSpan = document.createElement("span")
    siteSpan.textContent = "English title…"
    wrapper.replaceChildren(siteSpan)
    await flushDomUpdates()

    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(1)
    expect(mockTranslateNodesBilingualMode).toHaveBeenCalledWith([tweet], "walk-id", DEFAULT_CONFIG)

    manager.stop()
  })

  it("ignores in-wrapper mutations that leave the wrapper text unchanged (#1918)", async () => {
    document.body.innerHTML = `
      <p id="tweet"><span id="source">English title</span></p>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const tweet = document.getElementById("tweet") as HTMLElement
    const wrapper = document.createElement("span")
    wrapper.className = "notranslate read-frog-translated-content-wrapper"
    wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
    wrapper.append("中文译文")
    tweet.append(wrapper)
    const state: BilingualTranslationState = {
      layoutSource: tweet,
      sourceTextContent: "English title",
      status: "active",
      walkId: "walk-id",
      wrapper,
      wrapperTextContent: wrapper.textContent,
    }
    registerBilingualTranslationState(state)
    await flushDomUpdates()
    mockWalkAndLabelElement.mockClear()
    mockTranslateNodesBilingualMode.mockClear()

    // Node identity churn with identical text (React re-render writing the
    // same content) must stay classified as self-inflicted noise.
    wrapper.replaceChildren(document.createTextNode("中文译文"))
    await flushDomUpdates()

    expect(mockWalkAndLabelElement).not.toHaveBeenCalled()
    expect(mockTranslateNodesBilingualMode).not.toHaveBeenCalled()

    unregisterBilingualTranslationState(state)
    manager.stop()
  })

  it("caps tamper-driven retranslation passes behind the budget (#1918)", async () => {
    vi.useFakeTimers()
    const flushWithFakeTimers = async (rounds = 4) => {
      for (let i = 0; i < rounds; i++) {
        await Promise.resolve()
        await vi.advanceTimersByTimeAsync(0)
        await Promise.resolve()
      }
    }

    try {
      document.body.innerHTML = `
        <p id="tweet"><span id="source">English title</span></p>
      `

      const manager = new PageTranslationManager()
      await manager.start()
      await flushWithFakeTimers()

      const tweet = document.getElementById("tweet") as HTMLElement
      const wrapper = document.createElement("span")
      wrapper.className = "notranslate read-frog-translated-content-wrapper"
      wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
      wrapper.append("译文 0")
      tweet.append(wrapper)
      const translatedTextNode = wrapper.firstChild as Text
      // Snapshot never matches the wrapper, so every in-wrapper rewrite marks
      // the source stale — a site truncation script fighting our repairs.
      const state: BilingualTranslationState = {
        layoutSource: tweet,
        sourceTextContent: "English title",
        status: "active",
        walkId: "walk-id",
        wrapper,
        wrapperTextContent: "expected 译文",
      }
      registerBilingualTranslationState(state)
      await flushWithFakeTimers()
      mockTranslateNodesBilingualMode.mockClear()

      let churn = 0
      mockTranslateNodesBilingualMode.mockImplementation(async () => {
        churn += 1
        translatedTextNode.data = `译文 ${churn}`
        await flushWithFakeTimers(2)
      })

      translatedTextNode.data = "译文 start"
      await flushWithFakeTimers(8)

      // Same #1831 protections, new record class: per-invocation pass cap…
      expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(3)
      expect((manager as any).pendingRetranslateRetries.size).toBe(1)

      // …then the debounced retry burns the rest of the per-window budget.
      await vi.advanceTimersByTimeAsync(1000)
      await flushWithFakeTimers()
      expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(6)

      manager.stop()
      expect((manager as any).pendingRetranslateRetries.size).toBe(0)

      unregisterBilingualTranslationState(state)
    } finally {
      vi.useRealTimers()
    }
  })

  it("caps retranslation passes and defers perpetual churn behind a debounced retry (#1831)", async () => {
    vi.useFakeTimers()
    const flushWithFakeTimers = async (rounds = 4) => {
      for (let i = 0; i < rounds; i++) {
        await Promise.resolve()
        await vi.advanceTimersByTimeAsync(0)
        await Promise.resolve()
      }
    }

    try {
      document.body.innerHTML = `
        <p id="tweet"><span id="source">Ticker 0</span></p>
      `

      const manager = new PageTranslationManager()
      await manager.start()
      await flushWithFakeTimers()

      const tweet = document.getElementById("tweet") as HTMLElement
      const source = document.getElementById("source")!.firstChild as Text
      const wrapper = document.createElement("span")
      wrapper.className = "notranslate read-frog-translated-content-wrapper"
      wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
      tweet.append(wrapper)
      // Snapshot never matches, so every mutation marks the source stale —
      // the pathological ticker page.
      const state: BilingualTranslationState = {
        layoutSource: tweet,
        sourceTextContent: "never matches",
        status: "active",
        walkId: "walk-id",
        wrapper,
        wrapperTextContent: null,
      }
      registerBilingualTranslationState(state)
      await flushWithFakeTimers()
      mockTranslateNodesBilingualMode.mockClear()

      let churn = 0
      mockTranslateNodesBilingualMode.mockImplementation(async () => {
        churn += 1
        source.data = `Ticker ${churn}`
        // Let the observer deliver the mutation before this pass resolves so
        // the do/while sees a bumped version every time.
        await flushWithFakeTimers(2)
      })

      source.data = "Ticker start"
      await flushWithFakeTimers(8)

      // Per-invocation cap: exactly MAX_REFRESH_PASSES synchronous passes.
      expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(3)
      expect((manager as any).pendingRetranslateRetries.size).toBe(1)

      // Debounced retry fires and burns the rest of the per-window budget.
      await vi.advanceTimersByTimeAsync(1000)
      await flushWithFakeTimers()
      expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(6)

      // Budget exhausted: the next retry is a no-op that re-arms itself.
      await vi.advanceTimersByTimeAsync(1000)
      await flushWithFakeTimers()
      expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(6)

      // stop() cancels pending retries; nothing fires afterwards.
      manager.stop()
      expect((manager as any).pendingRetranslateRetries.size).toBe(0)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(mockTranslateNodesBilingualMode).toHaveBeenCalledTimes(6)

      unregisterBilingualTranslationState(state)
    } finally {
      vi.useRealTimers()
    }
  })

  it("unmounts the error-UI React root when the site removes an ancestor of our wrapper (#1831)", async () => {
    document.body.innerHTML = `
      <div id="comment"><p id="tweet"><span id="source">Original content</span></p></div>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const comment = document.getElementById("comment") as HTMLElement
    const tweet = document.getElementById("tweet") as HTMLElement
    const wrapper = document.createElement("span")
    wrapper.className = "notranslate read-frog-translated-content-wrapper"
    const errorHost = document.createElement("div")
    errorHost.className = "read-frog-react-shadow-host"
    const cleanupSpy = vi.fn<() => void>()
    ;(errorHost as any).__reactShadowContainerCleanup = cleanupSpy
    wrapper.append(errorHost)
    tweet.append(wrapper)
    await flushDomUpdates()

    // Site-driven removal of the whole comment subtree.
    comment.remove()
    await flushDomUpdates()

    expect(cleanupSpy).toHaveBeenCalledTimes(1)

    // Idempotent on a duplicate delivery of the same removal.
    ;(manager as any).cleanupDetachedTranslationArtifacts([comment])
    expect(cleanupSpy).toHaveBeenCalledTimes(1)

    manager.stop()
  })

  it("does not accumulate mutation observers when a shadow-root element is re-added (#1831)", async () => {
    const host = document.createElement("div")
    host.id = "shadow-host"
    const shadowRoot = host.attachShadow({ mode: "open" })
    const shadowChild = document.createElement("div")
    shadowChild.innerHTML = "<p>Shadow paragraph</p>"
    shadowRoot.append(shadowChild)
    document.body.append(host)

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const observerCountAfterStart = (manager as any).mutationObservers.length
    expect(observerCountAfterStart).toBeGreaterThan(0)

    for (let i = 0; i < 5; i++) {
      host.remove()
      await flushDomUpdates()
      document.body.append(host)
      await flushDomUpdates()
    }

    expect((manager as any).mutationObservers.length).toBe(observerCountAfterStart)

    manager.stop()
  })

  it("splits a giant paragraph into its descendant paragraphs for observation (#1881)", async () => {
    // docs.docker.com regression shape: one flat container labeled as a
    // paragraph spanning the whole document, with real paragraphs nested
    // inside. Built via DOM APIs — the HTML parser refuses nested <p>.
    const giant = document.createElement("p")
    giant.id = "giant"
    giant.append("direct inline text of the giant")
    const inner1 = document.createElement("p")
    inner1.id = "inner1"
    inner1.textContent = "Nested paragraph one"
    const inner2 = document.createElement("p")
    inner2.id = "inner2"
    inner2.textContent = "Nested paragraph two"
    giant.append(inner1, inner2)

    const unsplittable = document.createElement("p")
    unsplittable.id = "unsplittable"
    unsplittable.textContent = "One enormous paragraph without nested paragraphs"

    document.body.append(giant, unsplittable)
    // jsdom rects default to 0 — mark only the giants as taller than the
    // split cap (3 viewports).
    const tall = { height: 200_000 } as DOMRect
    giant.getBoundingClientRect = () => tall
    unsplittable.getBoundingClientRect = () => tall

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const observer = intersectionObservers[0]
    const observed = observer.observe.mock.calls.map((call) => call[0])
    // The giant is split: its nested paragraphs are observed individually.
    expect(observed).toContain(inner1)
    expect(observed).toContain(inner2)
    expect(observed).not.toContain(giant)
    // A giant with no nested paragraphs cannot be split — observed whole.
    expect(observed).toContain(unsplittable)

    manager.stop()
  })
})
