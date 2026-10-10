// @vitest-environment jsdom

/**
 * Identical rewrites of a translated subtree, through the whole content-script
 * pipeline.
 *
 * React 19 re-applies dangerouslySetInnerHTML on every re-render, so a site can
 * replace a translated article body with an identical copy at any time.
 * translation-carry.test.ts pins the move itself; this file pins what the move
 * relies on, with the REAL traversal, filter, walker and bilingual mode: the
 * copy keeps its translations, and the walk that follows the rewrite sends no
 * new provider request, while a rewrite that changes the text still
 * retranslates. Only the provider call, decoration and messaging are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { PageTranslationManager } from "../page-translation"

const {
  mockGetLocalConfig,
  mockGetOrCreateWebPageContext,
  mockSendMessage,
  mockTranslateTextForPage,
  mockTranslateTextForPageTitle,
  mockValidateTranslationConfigAndToast,
} = vi.hoisted(() => ({
  mockGetLocalConfig: vi.fn<(...args: any[]) => any>(),
  mockGetOrCreateWebPageContext: vi.fn<(...args: any[]) => any>(),
  mockSendMessage: vi.fn<(...args: any[]) => any>(),
  mockTranslateTextForPage: vi.fn<(...args: any[]) => any>(),
  mockTranslateTextForPageTitle: vi.fn<(...args: any[]) => any>(),
  mockValidateTranslationConfigAndToast: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/config/storage", () => ({ getLocalConfig: mockGetLocalConfig }))
vi.mock("@/utils/host/translate/filter-small-paragraph", () => ({
  shouldFilterSmallParagraph: vi.fn<(...args: any[]) => any>().mockResolvedValue(false),
}))
vi.mock("@/utils/host/translate/target-language-skip", () => ({
  shouldSkipAsTargetLanguage: vi.fn<(...args: any[]) => any>().mockResolvedValue(false),
}))
vi.mock("@/utils/host/translate/translate-text", () => ({
  validateTranslationConfigAndToast: mockValidateTranslationConfigAndToast,
}))
vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mockTranslateTextForPage,
  translateTextForPageTitle: mockTranslateTextForPageTitle,
}))
vi.mock("@/utils/host/translate/ui/decorate-translation", () => ({
  decorateTranslationNode: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
}))
vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: mockGetOrCreateWebPageContext,
}))
vi.mock("@/utils/message", () => ({ sendMessage: mockSendMessage }))

const observedTargets = new Set<Element>()
const intersectionObservers: MockIntersectionObserver[] = []

class MockIntersectionObserver {
  constructor(readonly callback: IntersectionObserverCallback) {
    intersectionObservers.push(this)
  }

  observe(target: Element): void {
    observedTargets.add(target)
  }

  unobserve(target: Element): void {
    observedTargets.delete(target)
  }

  disconnect(): void {
    observedTargets.clear()
  }
}

/** Brings every observed unit into view at once. */
function intersectAll(): void {
  const observer = intersectionObservers.at(-1)!
  const entries = [...observedTargets].map(
    (target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry,
  )
  observer.callback(entries, observer as unknown as IntersectionObserver)
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

const ARTICLE_HTML = [
  "<p>The package does not create new regimes.</p>",
  "<p>The amendment now moves to the European Parliament.</p>",
].join("\n")

function translationsIn(root: HTMLElement): string[] {
  return [...root.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)].map(
    (wrapper) => wrapper.textContent ?? "",
  )
}

async function startAndTranslate(article: HTMLElement): Promise<PageTranslationManager> {
  const manager = new PageTranslationManager()
  await manager.start()
  intersectAll()
  await vi.waitFor(() =>
    expect(translationsIn(article)).toEqual([
      "译文：The package does not create new regimes.",
      "译文：The amendment now moves to the European Parliament.",
    ]),
  )
  return manager
}

describe("identical rewrite of a translated subtree (real pipeline)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    observedTargets.clear()
    intersectionObservers.length = 0
    document.body.innerHTML = ""
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

    mockGetLocalConfig.mockResolvedValue(DEFAULT_CONFIG)
    mockGetOrCreateWebPageContext.mockResolvedValue({ url: "", webTitle: "", webContent: "" })
    mockSendMessage.mockResolvedValue(undefined)
    mockTranslateTextForPage.mockImplementation(async (text: string) => `译文：${text}`)
    mockTranslateTextForPageTitle.mockResolvedValue("")
    mockValidateTranslationConfigAndToast.mockReturnValue(true)
  })

  it("keeps the translations and sends no new request when the site rewrites identical HTML", async () => {
    document.body.innerHTML = `<div id="article">${ARTICLE_HTML}</div>`
    const article = document.getElementById("article")!
    const manager = await startAndTranslate(article)
    try {
      const oldFirst = article.firstElementChild
      const wrappers = [...article.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)]
      expect(mockTranslateTextForPage).toHaveBeenCalledTimes(2)

      // React 19 re-applying the same dangerouslySetInnerHTML.
      article.innerHTML = ARTICLE_HTML
      expect(article.firstElementChild).not.toBe(oldFirst)

      // The walk over the copies observes them; bring them into view.
      await vi.waitFor(() => expect(observedTargets.size).toBe(2))
      intersectAll()
      await settle()

      // The same wrapper nodes, not equal-looking retranslations (toEqual
      // compares DOM nodes structurally).
      const carried = [...article.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)]
      expect(carried).toHaveLength(wrappers.length)
      carried.forEach((wrapper, index) => expect(wrapper).toBe(wrappers[index]))
      expect(translationsIn(article)).toEqual([
        "译文：The package does not create new regimes.",
        "译文：The amendment now moves to the European Parliament.",
      ])
      expect(mockTranslateTextForPage).toHaveBeenCalledTimes(2)
    } finally {
      manager.stop()
    }
  })

  it("still retranslates when the rewrite changes the text", async () => {
    document.body.innerHTML = `<div id="article">${ARTICLE_HTML}</div>`
    const article = document.getElementById("article")!
    const manager = await startAndTranslate(article)
    try {
      article.innerHTML = ARTICLE_HTML.replace("European Parliament", "Council")

      await vi.waitFor(() => expect(observedTargets.size).toBe(2))
      intersectAll()

      await vi.waitFor(() =>
        expect(translationsIn(article)).toEqual([
          "译文：The package does not create new regimes.",
          "译文：The amendment now moves to the Council.",
        ]),
      )
      expect(mockTranslateTextForPage).toHaveBeenCalledTimes(4)
    } finally {
      manager.stop()
    }
  })
})
