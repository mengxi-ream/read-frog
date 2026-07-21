// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
  TRANSLATION_ERROR_CONTAINER_CLASS,
} from "@/utils/constants/dom-labels"
import { removeAllTranslatedWrapperNodes } from "../../dom/translation-cleanup"
import { translateNodesBilingualMode } from "../translation-modes"
import {
  getBilingualTranslationStateForSource,
  isBilingualTranslationStateCurrent,
  MAX_WRAPPER_TAMPER_REPAIRS,
  registerBilingualTranslationState,
  unregisterBilingualTranslationState,
  type BilingualTranslationState,
} from "../translation-state"

const { mockDecorateTranslationNode, mockShouldFilterSmallParagraph, mockTranslateTextForPage } =
  vi.hoisted(() => ({
    mockDecorateTranslationNode: vi.fn<(...args: any[]) => any>(),
    mockShouldFilterSmallParagraph: vi.fn<(...args: any[]) => any>(),
    mockTranslateTextForPage: vi.fn<(...args: any[]) => any>(),
  }))

vi.mock("@/utils/host/translate/filter-small-paragraph", () => ({
  shouldFilterSmallParagraph: mockShouldFilterSmallParagraph,
}))

vi.mock("@/utils/host/translate/target-language-skip", () => ({
  shouldSkipAsTargetLanguage: vi.fn<(...args: any[]) => any>().mockResolvedValue(false),
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mockTranslateTextForPage,
}))

vi.mock("@/utils/host/translate/ui/decorate-translation", () => ({
  decorateTranslationNode: mockDecorateTranslationNode,
}))

function createSource(text = "English source title"): HTMLElement {
  const source = document.createElement("div")
  source.textContent = text
  source.setAttribute(BLOCK_ATTRIBUTE, "")
  source.setAttribute(PARAGRAPH_ATTRIBUTE, "")
  document.body.append(source)
  return source
}

function getWrapper(source: HTMLElement): HTMLElement {
  const wrapper = source.querySelector<HTMLElement>(`.${CONTENT_WRAPPER_CLASS}`)
  expect(wrapper).not.toBeNull()
  return wrapper!
}

/** The translated content span the site would rewrite (CNBC truncation, #1918). */
function tamperWrapper(wrapper: HTMLElement, text: string): void {
  const translatedNode = wrapper.lastElementChild as HTMLElement
  translatedNode.textContent = text
}

describe("bilingual wrapper tamper recovery (#1918)", () => {
  beforeEach(() => {
    document.body.replaceChildren()
    mockDecorateTranslationNode.mockReset().mockResolvedValue(undefined)
    mockShouldFilterSmallParagraph.mockReset().mockResolvedValue(false)
    mockTranslateTextForPage.mockReset().mockResolvedValue("translated")
  })

  afterEach(() => {
    removeAllTranslatedWrapperNodes(document)
  })

  it("snapshots the wrapper content after a successful translation", async () => {
    const source = createSource()
    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)

    const wrapper = getWrapper(source)
    const state = getBilingualTranslationStateForSource(source)!
    expect(wrapper.textContent).toContain("translated")
    expect(state.wrapperTextContent).toBe(wrapper.textContent)
    expect(isBilingualTranslationStateCurrent(state)).toBe(true)
  })

  it("keeps the snapshot null until the translated content is inserted", async () => {
    const source = createSource()
    let resolveTranslate!: (value: string) => void
    mockTranslateTextForPage.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveTranslate = resolve
      }),
    )

    const run = translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)
    // Let filtering settle and the wrapper/spinner insert while the provider
    // round-trip is still pending — the construction window.
    await new Promise((resolve) => setTimeout(resolve, 0))
    const pendingState = getBilingualTranslationStateForSource(source)!
    expect(pendingState.wrapper).not.toBeNull()
    expect(pendingState.wrapperTextContent).toBeNull()

    resolveTranslate("translated")
    await run
    expect(pendingState.wrapperTextContent).toBe(pendingState.wrapper!.textContent)
  })

  it("repairs a tampered wrapper that the same walk previously short-circuited", async () => {
    const source = createSource()
    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)
    const wrapper = getWrapper(source)
    const state = getBilingualTranslationStateForSource(source)!

    tamperWrapper(wrapper, "truncated english…")
    expect(isBilingualTranslationStateCurrent(state)).toBe(false)

    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)

    const repairedWrapper = getWrapper(source)
    expect(repairedWrapper).not.toBe(wrapper)
    expect(repairedWrapper.textContent).toContain("translated")
    const repairedState = getBilingualTranslationStateForSource(source)!
    expect(repairedState.wrapperTextContent).toBe(repairedWrapper.textContent)
    expect(isBilingualTranslationStateCurrent(repairedState)).toBe(true)
  })

  it("capitulates after the repair budget and adopts the site's wrapper content", async () => {
    const source = createSource()
    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)

    for (let round = 1; round <= MAX_WRAPPER_TAMPER_REPAIRS; round++) {
      tamperWrapper(getWrapper(source), `tampered ${round}`)
      await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)
      expect(getWrapper(source).textContent).toContain("translated")
    }

    // The site wins the next round: content is adopted instead of re-fought.
    const finalWrapper = getWrapper(source)
    tamperWrapper(finalWrapper, "site version")
    mockTranslateTextForPage.mockClear()
    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)

    expect(getWrapper(source)).toBe(finalWrapper)
    expect(finalWrapper.textContent).toContain("site version")
    const state = getBilingualTranslationStateForSource(source)!
    expect(state.wrapperTextContent).toBe(finalWrapper.textContent)
    expect(isBilingualTranslationStateCurrent(state)).toBe(true)
    expect(mockTranslateTextForPage).not.toHaveBeenCalled()
  })

  it("re-arms the capitulation budget when the host text genuinely changes", async () => {
    const source = createSource()
    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)

    // Burn the whole repair budget.
    for (let round = 0; round <= MAX_WRAPPER_TAMPER_REPAIRS; round++) {
      tamperWrapper(getWrapper(source), `tampered ${round}`)
      await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)
    }
    expect(getWrapper(source).textContent).toContain(`tampered ${MAX_WRAPPER_TAMPER_REPAIRS}`)

    // Genuine host change resets the counter and retranslates…
    source.firstChild!.textContent = "Fresh host content"
    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)
    expect(getWrapper(source).textContent).toContain("translated")

    // …so the next tamper gets repaired again instead of being adopted.
    tamperWrapper(getWrapper(source), "tampered again")
    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)
    expect(getWrapper(source).textContent).toContain("translated")
  })

  it("removes the wrapper instead of canonizing a tamper landing in the decorate window", async () => {
    const source = createSource()
    mockDecorateTranslationNode.mockImplementationOnce(async (node: HTMLElement) => {
      // Site rewrite racing the decorate await: the snapshot was already
      // armed at append time, so isCurrent() fails and the fail-safe removes
      // the wrapper instead of blessing the tampered content.
      node.textContent = "tampered during decorate"
      await Promise.resolve()
    })

    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)

    expect(source.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(getBilingualTranslationStateForSource(source)).toBeUndefined()
  })

  it("keeps the snapshot null on the provider-error path", async () => {
    const source = createSource()
    mockTranslateTextForPage.mockRejectedValue(new Error("provider down"))

    await translateNodesBilingualMode([source], "walk-1", DEFAULT_CONFIG)

    const wrapper = getWrapper(source)
    expect(wrapper.querySelector(`.${TRANSLATION_ERROR_CONTAINER_CLASS}`)).not.toBeNull()
    const state = getBilingualTranslationStateForSource(source)!
    expect(state.wrapperTextContent).toBeNull()
    // Error-host churn inside the wrapper keeps its pre-#1918 classification.
    expect(isBilingualTranslationStateCurrent(state)).toBe(true)
  })
})

describe("isBilingualTranslationStateCurrent wrapper-content integrity (#1918)", () => {
  function buildState(): {
    layoutSource: HTMLElement
    wrapper: HTMLElement
    state: BilingualTranslationState
  } {
    const layoutSource = document.createElement("div")
    layoutSource.textContent = "Host text"
    const wrapper = document.createElement("span")
    wrapper.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    wrapper.textContent = "译文"
    layoutSource.append(wrapper)
    document.body.append(layoutSource)
    const state: BilingualTranslationState = {
      layoutSource,
      sourceTextContent: "Host text",
      status: "active",
      walkId: "walk-1",
      wrapper,
      wrapperTextContent: wrapper.textContent,
    }
    registerBilingualTranslationState(state)
    return { layoutSource, state, wrapper }
  }

  beforeEach(() => {
    document.body.replaceChildren()
  })

  it("stays current while the wrapper content matches the snapshot", () => {
    const { state } = buildState()
    expect(isBilingualTranslationStateCurrent(state)).toBe(true)
    unregisterBilingualTranslationState(state)
  })

  it("ignores wrapper content when the snapshot is null (construction window)", () => {
    const { state, wrapper } = buildState()
    state.wrapperTextContent = null
    wrapper.textContent = "anything the extension writes mid-construction"
    expect(isBilingualTranslationStateCurrent(state)).toBe(true)
    unregisterBilingualTranslationState(state)
  })

  it("goes stale when the wrapper content diverges from the snapshot", () => {
    const { state, wrapper } = buildState()
    wrapper.textContent = "truncated english…"
    expect(isBilingualTranslationStateCurrent(state)).toBe(false)
    unregisterBilingualTranslationState(state)
  })

  it("still goes stale on host-text changes with a matching wrapper", () => {
    const { layoutSource, state } = buildState()
    layoutSource.append("real host change")
    expect(isBilingualTranslationStateCurrent(state)).toBe(false)
    unregisterBilingualTranslationState(state)
  })
})
