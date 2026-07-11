// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
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
  isHTMLElement: (node: unknown) => node instanceof HTMLElement,
}))

vi.mock("@/utils/host/dom/find", () => ({
  deepQueryTopLevelSelector: mockDeepQueryTopLevelSelector,
}))

vi.mock("@/utils/host/dom/traversal", () => ({
  walkAndLabelElement: mockWalkAndLabelElement,
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

function walkAndLabelVisibleParagraphs(element: HTMLElement, walkId: string) {
  if (isBlockedForTraversal(element)) {
    return {
      forceBlock: false,
      isInlineNode: false,
    }
  }

  element.setAttribute("data-read-frog-walked", walkId)

  for (const child of element.children) {
    if (child instanceof HTMLElement) {
      walkAndLabelVisibleParagraphs(child, walkId)
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
    mockWalkAndLabelElement.mockImplementation((element: HTMLElement, walkId: string) =>
      walkAndLabelVisibleParagraphs(element, walkId),
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

    expect(mockTranslateWalkedElement).toHaveBeenCalledWith(panel, "walk-id", DEFAULT_CONFIG)

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

    expect(mockTranslateWalkedElement).toHaveBeenCalledWith(panel, "walk-id", DEFAULT_CONFIG)

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

    expect(mockTranslateWalkedElement).toHaveBeenCalledWith(panel, "walk-id", DEFAULT_CONFIG)

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
})
