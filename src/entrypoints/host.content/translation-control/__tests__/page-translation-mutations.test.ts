// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  getBilingualTranslationStateForSource,
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
  isTranslatedWrapperNode: (node: unknown) =>
    node instanceof HTMLElement && node.classList.contains("read-frog-translated-content-wrapper"),
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

function attachBilingualTranslationState(
  source: HTMLElement,
  translatedText: string,
  options: {
    error?: boolean
    insertionParent?: HTMLElement
    phase?: BilingualTranslationState["phase"]
  } = {},
): { state: BilingualTranslationState; wrapper: HTMLElement } {
  const wrapper = document.createElement("span")
  wrapper.className = "notranslate read-frog-translated-content-wrapper"
  wrapper.setAttribute("data-read-frog-translation-mode", "bilingual")
  wrapper.setAttribute("data-read-frog-walked", "walk-id")
  const translated = document.createElement("span")
  translated.className = "notranslate read-frog-translated-block-content"
  translated.textContent = translatedText
  wrapper.append(document.createElement("br"), translated)
  if (options.error) {
    const error = document.createElement("span")
    error.className = "read-frog-translation-error-container"
    wrapper.append(error)
  }
  ;(options.insertionParent ?? source).append(wrapper)

  const state: BilingualTranslationState = {
    layoutSource: source,
    sourceTextContent: source.textContent?.replace(translatedText, "").trim() ?? "",
    phase: options.phase ?? "complete",
    status: "active",
    walkId: "walk-id",
    wrapper,
  }
  registerBilingualTranslationState(state)
  return { state, wrapper }
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

  it("moves a completed translation to an equivalent replacement before config lookup resolves (#1854)", async () => {
    document.body.innerHTML = `<main id="lesson"><p id="source">Python variables</p></main>`

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    const oldSource = document.getElementById("source") as HTMLElement
    const { wrapper } = attachBilingualTranslationState(oldSource, "Python 变量")
    await flushDomUpdates()
    mockTranslateWalkedElement.mockClear()

    let resolveConfig!: (config: typeof DEFAULT_CONFIG) => void
    mockGetLocalConfig.mockReturnValue(
      new Promise<typeof DEFAULT_CONFIG>((resolve) => {
        resolveConfig = resolve
      }),
    )

    const newSource = document.createElement("p")
    newSource.id = "source"
    newSource.textContent = "Python variables"
    lesson.replaceChild(newSource, oldSource)

    await Promise.resolve()
    await Promise.resolve()

    expect(newSource.querySelector(".read-frog-translated-content-wrapper")).toBe(wrapper)
    expect(getBilingualTranslationStateForSource(newSource)).toMatchObject({
      phase: "complete",
      sourceTextContent: "Python variables",
      walkId: "walk-id",
    })
    expect(mockTranslateWalkedElement).not.toHaveBeenCalled()

    resolveConfig(DEFAULT_CONFIG)
    await flushDomUpdates()
    manager.stop()
  })

  it("restores a cached translation when removal and insertion arrive separately (#1854)", async () => {
    document.body.innerHTML = `<main id="lesson"><p id="source">Python lists</p></main>`

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    const oldSource = document.getElementById("source") as HTMLElement
    const { wrapper: oldWrapper } = attachBilingualTranslationState(oldSource, "Python 列表")
    await flushDomUpdates()

    oldSource.remove()
    await flushDomUpdates()

    const newSource = document.createElement("p")
    newSource.id = "source"
    newSource.textContent = "Python lists"
    lesson.append(newSource)
    await flushDomUpdates()

    const restoredWrapper = newSource.querySelector<HTMLElement>(
      ".read-frog-translated-content-wrapper",
    )
    expect(restoredWrapper).not.toBeNull()
    expect(restoredWrapper).not.toBe(oldWrapper)
    expect(restoredWrapper?.textContent).toContain("Python 列表")
    expect(getBilingualTranslationStateForSource(newSource)?.phase).toBe("complete")
    expect(mockTranslateNodesBilingualMode).not.toHaveBeenCalled()

    manager.stop()
  })

  it("does not reuse a translation when source text or host structure changed (#1854)", async () => {
    document.body.innerHTML = `
      <main id="lesson">
        <p id="changed-text">Python tuples</p>
        <p id="changed-structure"><span>Python dictionaries</span></p>
      </main>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    const changedText = document.getElementById("changed-text") as HTMLElement
    const changedStructure = document.getElementById("changed-structure") as HTMLElement
    attachBilingualTranslationState(changedText, "Python 元组")
    attachBilingualTranslationState(changedStructure, "Python 字典", {
      insertionParent: changedStructure.firstElementChild as HTMLElement,
    })
    await flushDomUpdates()

    const newTextSource = document.createElement("p")
    newTextSource.textContent = "Python sets"
    lesson.replaceChild(newTextSource, changedText)

    const newStructureSource = document.createElement("p")
    newStructureSource.innerHTML = "<em><span>Python dictionaries</span></em>"
    lesson.replaceChild(newStructureSource, changedStructure)
    await flushDomUpdates()

    expect(newTextSource.querySelector(".read-frog-translated-content-wrapper")).toBeNull()
    expect(newStructureSource.querySelector(".read-frog-translated-content-wrapper")).toBeNull()

    manager.stop()
  })

  it("does not cache pending or error translations (#1854)", async () => {
    document.body.innerHTML = `
      <main id="lesson">
        <p id="pending">Pending paragraph</p>
        <p id="error">Error paragraph</p>
      </main>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    const pending = document.getElementById("pending") as HTMLElement
    const error = document.getElementById("error") as HTMLElement
    attachBilingualTranslationState(pending, "等待中的译文", { phase: "pending" })
    attachBilingualTranslationState(error, "错误译文", { error: true })
    await flushDomUpdates()

    const newPending = document.createElement("p")
    newPending.textContent = "Pending paragraph"
    const newError = document.createElement("p")
    newError.textContent = "Error paragraph"
    lesson.replaceChildren(newPending, newError)
    await flushDomUpdates()

    expect(newPending.querySelector(".read-frog-translated-content-wrapper")).toBeNull()
    expect(newError.querySelector(".read-frog-translated-content-wrapper")).toBeNull()

    manager.stop()
  })

  it("counts pending generations toward the cross-node circuit breaker without copying them (#1854)", async () => {
    document.body.innerHTML = `<main id="lesson"><p>Pending loop</p></main>`

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    let current = lesson.firstElementChild as HTMLElement
    attachBilingualTranslationState(current, "未完成", { phase: "pending" })
    await flushDomUpdates()

    for (let index = 0; index < 6; index++) {
      const replacement = document.createElement("p")
      replacement.textContent = "Pending loop"
      lesson.replaceChild(replacement, current)
      current = replacement
      await flushDomUpdates()
      expect(current.querySelector(".read-frog-translated-content-wrapper")).toBeNull()
      attachBilingualTranslationState(current, "未完成", { phase: "pending" })
      await flushDomUpdates()
    }

    const suppressed = document.createElement("p")
    suppressed.textContent = "Pending loop"
    lesson.replaceChild(suppressed, current)
    current = suppressed
    await flushDomUpdates()

    expect(current.querySelector(".read-frog-translated-content-wrapper")).toBeNull()
    expect(intersectionObservers[0].observe.mock.calls.some(([target]) => target === current)).toBe(
      false,
    )

    manager.stop()
  })

  it("restores repeated identical paragraphs without duplicating wrappers (#1854)", async () => {
    document.body.innerHTML = `
      <main id="lesson">
        <p>Shared paragraph</p>
        <p>Shared paragraph</p>
      </main>
    `

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    const oldSources = [...lesson.querySelectorAll<HTMLElement>("p")]
    oldSources.forEach((source) => attachBilingualTranslationState(source, "重复段落"))
    await flushDomUpdates()

    const replacements = [document.createElement("p"), document.createElement("p")]
    replacements.forEach((source) => {
      source.textContent = "Shared paragraph"
    })
    lesson.replaceChildren(...replacements)
    await flushDomUpdates()

    expect(
      replacements.map(
        (source) => source.querySelectorAll(".read-frog-translated-content-wrapper").length,
      ),
    ).toEqual([1, 1])
    expect(replacements.map((source) => source.textContent)).toEqual([
      "Shared paragraph重复段落",
      "Shared paragraph重复段落",
    ])

    manager.stop()
  })

  it("stops restoring one logical paragraph after six rapid replacements and resets on restart (#1854)", async () => {
    document.body.innerHTML = `<main id="lesson"><p>Looping paragraph</p></main>`

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    let current = lesson.firstElementChild as HTMLElement
    attachBilingualTranslationState(current, "循环段落")
    await flushDomUpdates()

    for (let index = 0; index < 6; index++) {
      const replacement = document.createElement("p")
      replacement.textContent = "Looping paragraph"
      lesson.replaceChild(replacement, current)
      current = replacement
      await flushDomUpdates()
      expect(current.querySelectorAll(".read-frog-translated-content-wrapper")).toHaveLength(1)
    }

    const suppressed = document.createElement("p")
    suppressed.textContent = "Looping paragraph"
    lesson.replaceChild(suppressed, current)
    current = suppressed
    await flushDomUpdates()

    expect(current.querySelector(".read-frog-translated-content-wrapper")).toBeNull()
    expect(intersectionObservers[0].observe.mock.calls.some(([target]) => target === current)).toBe(
      false,
    )

    const stillSuppressed = document.createElement("p")
    stillSuppressed.textContent = "Looping paragraph"
    lesson.replaceChild(stillSuppressed, current)
    current = stillSuppressed
    await flushDomUpdates()
    expect(current.querySelector(".read-frog-translated-content-wrapper")).toBeNull()

    current.textContent = "Looping paragraph changed"
    await flushDomUpdates()
    expect(intersectionObservers[0].observe.mock.calls.some(([target]) => target === current)).toBe(
      true,
    )

    manager.stop()
    await manager.start()
    await flushDomUpdates()
    expect(intersectionObservers[1].observe).toHaveBeenCalledWith(current)

    manager.stop()
  })

  it("does not spend the autonomous-loop budget while the user is actively scrolling (#1854)", async () => {
    document.body.innerHTML = `<main id="lesson"><p>Scrolling paragraph</p></main>`

    const manager = new PageTranslationManager()
    await manager.start()
    await flushDomUpdates()

    const lesson = document.getElementById("lesson") as HTMLElement
    let current = lesson.firstElementChild as HTMLElement
    attachBilingualTranslationState(current, "滚动段落")
    await flushDomUpdates()

    for (let index = 0; index < 10; index++) {
      document.dispatchEvent(new WheelEvent("wheel"))
      const replacement = document.createElement("p")
      replacement.textContent = "Scrolling paragraph"
      lesson.replaceChild(replacement, current)
      current = replacement
      await flushDomUpdates()
      expect(current.querySelectorAll(".read-frog-translated-content-wrapper")).toHaveLength(1)
    }

    manager.stop()
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
      phase: "complete",
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
        phase: "complete",
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
        phase: "complete",
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
      phase: "complete",
      status: "active",
      walkId: "walk-id",
      wrapper,
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
        phase: "complete",
        status: "active",
        walkId: "walk-id",
        wrapper,
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
      phase: "complete",
      status: "active",
      walkId: "walk-id",
      wrapper,
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
        phase: "complete",
        status: "active",
        walkId: "walk-id",
        wrapper,
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
})
