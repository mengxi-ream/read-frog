// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BLOCK_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  PARAGRAPH_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { removeAllTranslatedWrapperNodes } from "../../dom/translation-cleanup"
import { translateNodesBilingualMode } from "../translation-modes"
import { getBilingualTranslationStateForSource } from "../translation-state"

const { mockShouldFilterSmallParagraph, mockTranslateTextForPage } = vi.hoisted(() => ({
  mockShouldFilterSmallParagraph: vi.fn<(...args: any[]) => any>(),
  mockTranslateTextForPage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/filter-small-paragraph", () => ({
  shouldFilterSmallParagraph: mockShouldFilterSmallParagraph,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mockTranslateTextForPage,
}))

function createSource(): HTMLElement {
  const source = document.createElement("div")
  source.textContent = "Pending legacy bilingual source"
  source.setAttribute(BLOCK_ATTRIBUTE, "")
  source.setAttribute(PARAGRAPH_ATTRIBUTE, "")
  document.body.append(source)
  return source
}

function deferredFilter(): { promise: Promise<boolean>; resolve: (value: boolean) => void } {
  let resolve!: (value: boolean) => void
  const promise = new Promise<boolean>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

describe("legacy bilingual pending lifecycle", () => {
  beforeEach(() => {
    document.body.replaceChildren()
    mockShouldFilterSmallParagraph.mockReset()
    mockTranslateTextForPage.mockReset().mockResolvedValue("translated")
  })

  afterEach(() => {
    removeAllTranslatedWrapperNodes(document)
  })

  it("does not insert a wrapper after global cleanup while filtering is pending", async () => {
    const source = createSource()
    const filter = deferredFilter()
    mockShouldFilterSmallParagraph.mockReturnValue(filter.promise)

    const translation = translateNodesBilingualMode([source], "pending-stop", DEFAULT_CONFIG)
    await Promise.resolve()
    expect(getBilingualTranslationStateForSource(source)?.wrapper).toBeNull()

    removeAllTranslatedWrapperNodes(document)
    filter.resolve(false)
    await translation

    expect(mockTranslateTextForPage).not.toHaveBeenCalled()
    expect(source.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(getBilingualTranslationStateForSource(source)).toBeUndefined()
  })

  it("does not insert a wrapper after toggle cancels pending filtering", async () => {
    const source = createSource()
    const filter = deferredFilter()
    mockShouldFilterSmallParagraph.mockReturnValue(filter.promise)

    const translation = translateNodesBilingualMode([source], "pending-toggle", DEFAULT_CONFIG)
    await Promise.resolve()

    await translateNodesBilingualMode([source], "pending-toggle", DEFAULT_CONFIG, true)
    filter.resolve(false)
    await translation

    expect(mockTranslateTextForPage).not.toHaveBeenCalled()
    expect(source.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toBeNull()
    expect(getBilingualTranslationStateForSource(source)).toBeUndefined()
  })
})
