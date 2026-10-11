// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import {
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
  SPINNER_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { carryTranslationsAcrossRewrite } from "../translation-carry"
import {
  collectSourceTextExcludingWrappers,
  getBilingualTranslationStateForSource,
  isBilingualTranslationStateCurrent,
  registerBilingualTranslationState,
  type BilingualTranslationState,
} from "../translation-state"

const WALK_ID = "walk-id"
const ARTICLE_HTML = "<p>First paragraph.</p>\n<h2>Heading</h2>\n<p>Last paragraph.</p>"

function createWrapper(walkId = WALK_ID): HTMLElement {
  const wrapper = document.createElement("span")
  wrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
  wrapper.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "bilingual")
  wrapper.setAttribute(WALKED_ATTRIBUTE, walkId)
  return wrapper
}

function finishWrapper(wrapper: HTMLElement, translation: string): void {
  const content = document.createElement("span")
  content.className = `${NOTRANSLATE_CLASS} ${BLOCK_CONTENT_CLASS}`
  content.textContent = translation
  wrapper.append(document.createElement("br"), content)
}

function createPendingWrapper(): HTMLElement {
  const wrapper = createWrapper()
  const spinner = document.createElement("span")
  spinner.className = SPINNER_CLASS
  wrapper.append(spinner)
  return wrapper
}

function translateSource(
  source: HTMLElement,
  translation: string,
  walkId = WALK_ID,
): BilingualTranslationState {
  const wrapper = createWrapper(walkId)
  finishWrapper(wrapper, translation)
  source.append(wrapper)
  const state: BilingualTranslationState = {
    layoutSource: source,
    sourceTextContent: collectSourceTextExcludingWrappers(source),
    status: "active",
    walkId,
    wrapper,
    wrapperTextContent: wrapper.textContent,
  }
  registerBilingualTranslationState(state)
  return state
}

function createArticle(): HTMLElement {
  const article = document.createElement("div")
  article.innerHTML = ARTICLE_HTML
  document.body.append(article)
  return article
}

function rewrite(target: HTMLElement, html: string, walkId = WALK_ID): void {
  const observer = new MutationObserver(() => {})
  observer.observe(target, { childList: true })
  target.innerHTML = html
  const records = observer.takeRecords()
  observer.disconnect()
  records.forEach((record) => carryTranslationsAcrossRewrite(record, walkId))
}

describe("carryTranslationsAcrossRewrite", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("moves finished translations into an identical rewrite and re-keys their state", () => {
    const article = createArticle()
    const [first, heading] = [...article.children] as HTMLElement[]
    const firstState = translateSource(first!, "第一段。")
    const headingState = translateSource(heading!, "标题")

    // React 19 re-applying the same dangerouslySetInnerHTML.
    rewrite(article, ARTICLE_HTML)

    const [newFirst, newHeading, newLast] = [...article.children] as HTMLElement[]
    expect(newFirst).not.toBe(first)
    expect(newFirst!.lastElementChild).toBe(firstState.wrapper)
    expect(newHeading!.lastElementChild).toBe(headingState.wrapper)
    expect(newLast!.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(getBilingualTranslationStateForSource(newFirst!)).toBe(firstState)
    expect(getBilingualTranslationStateForSource(newHeading!)).toBe(headingState)
    expect(isBilingualTranslationStateCurrent(firstState)).toBe(true)
    expect(isBilingualTranslationStateCurrent(headingState)).toBe(true)
  })

  it("puts a wrapper after a bare text run back at the same position", () => {
    const html = "The targeted <a href='#'>amendment</a> eases compliance.<ul><li>Item</li></ul>"
    const article = document.createElement("div")
    article.innerHTML = html
    document.body.append(article)
    // Text-node runs get a sibling wrapper with no registered state.
    const runWrapper = createWrapper()
    finishWrapper(runWrapper, "该修正案简化了合规。")
    article.insertBefore(runWrapper, article.querySelector("ul"))

    rewrite(article, html)

    expect(runWrapper.isConnected).toBe(true)
    expect(runWrapper.previousSibling?.textContent).toBe(" eases compliance.")
    expect(runWrapper.nextSibling).toBe(article.querySelector("ul"))
  })

  it("keeps the old behavior when the rewrite changes the text", () => {
    const article = createArticle()
    const state = translateSource(article.firstElementChild as HTMLElement, "第一段。")

    rewrite(article, ARTICLE_HTML.replace("First paragraph.", "Edited paragraph."))

    expect(state.wrapper!.isConnected).toBe(false)
    expect(article.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
  })

  it("leaves a pending translation behind but still moves other units", () => {
    const article = createArticle()
    const [first, , last] = [...article.children] as HTMLElement[]
    first!.setAttribute(PARAGRAPH_ATTRIBUTE, "")
    last!.setAttribute(PARAGRAPH_ATTRIBUTE, "")
    const finished = translateSource(first!, "第一段。")
    const pendingWrapper = createPendingWrapper()
    last!.append(pendingWrapper)

    rewrite(article, ARTICLE_HTML)

    expect(finished.wrapper!.isConnected).toBe(true)
    expect(pendingWrapper.isConnected).toBe(false)
  })

  it("moves nothing from a unit that still has a pending translation", () => {
    const html = "<ul><li>First item.</li><li>Second item.</li></ul>"
    const article = document.createElement("div")
    article.innerHTML = html
    document.body.append(article)
    const list = article.firstElementChild as HTMLElement
    list.setAttribute(PARAGRAPH_ATTRIBUTE, "")
    const [firstItem, secondItem] = [...list.children] as HTMLElement[]
    const finished = translateSource(firstItem!, "第一项。")
    const pendingWrapper = createPendingWrapper()
    secondItem!.append(pendingWrapper)

    rewrite(article, html)

    // Carrying only the finished item would leave the list's copy holding a
    // wrapper, and the walk never translates such a unit again.
    expect(finished.wrapper!.isConnected).toBe(false)
    expect(pendingWrapper.isConnected).toBe(false)
  })

  it("moves nothing from another translation session", () => {
    const article = createArticle()
    const state = translateSource(article.firstElementChild as HTMLElement, "第一段。", "old-walk")

    rewrite(article, ARTICLE_HTML)

    expect(state.wrapper!.isConnected).toBe(false)
  })

  it("ignores a rewrite that replaces only part of the children", () => {
    const article = createArticle()
    const first = article.firstElementChild as HTMLElement
    const state = translateSource(first, "第一段。")
    const observer = new MutationObserver(() => {})
    observer.observe(article, { childList: true })
    const copy = document.createElement("p")
    copy.textContent = "First paragraph."
    first.replaceWith(copy)
    observer.takeRecords().forEach((record) => carryTranslationsAcrossRewrite(record, WALK_ID))
    observer.disconnect()

    expect(state.wrapper!.isConnected).toBe(false)
  })
})
