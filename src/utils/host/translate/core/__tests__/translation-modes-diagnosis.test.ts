// @vitest-environment jsdom

import type { PageTranslationRequestOptions } from "../../translate-variants"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BLOCK_ATTRIBUTE, PARAGRAPH_ATTRIBUTE } from "@/utils/constants/dom-labels"
import { removeAllTranslatedWrapperNodes } from "../../dom/translation-cleanup"
import { getDiagnosedParagraphs, resetParagraphDiagnosis } from "../../paragraph-diagnosis"
import { translateNodesBilingualMode, translateNodeTranslationOnlyMode } from "../translation-modes"

const { mockShouldFilterSmallParagraph, mockShouldSkipAsTargetLanguage, mockTranslateTextForPage } =
  vi.hoisted(() => ({
    mockShouldFilterSmallParagraph: vi.fn<(...args: any[]) => Promise<boolean>>(),
    mockShouldSkipAsTargetLanguage: vi.fn<(...args: any[]) => Promise<boolean>>(),
    mockTranslateTextForPage:
      vi.fn<
        (text: string, format: string, options?: PageTranslationRequestOptions) => Promise<string>
      >(),
  }))

vi.mock("@/utils/host/translate/filter-small-paragraph", () => ({
  shouldFilterSmallParagraph: mockShouldFilterSmallParagraph,
}))

vi.mock("@/utils/host/translate/target-language-skip", () => ({
  shouldSkipAsTargetLanguage: mockShouldSkipAsTargetLanguage,
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mockTranslateTextForPage,
}))

const SOURCE_TEXT = "A paragraph that page translation looks at"

function createSource(): HTMLElement {
  const source = document.createElement("div")
  source.textContent = SOURCE_TEXT
  source.setAttribute(BLOCK_ATTRIBUTE, "")
  source.setAttribute(PARAGRAPH_ATTRIBUTE, "")
  document.body.append(source)
  return source
}

const MODES = [
  [
    "bilingual",
    (source: HTMLElement) => translateNodesBilingualMode([source], "walk", DEFAULT_CONFIG),
  ],
  [
    "translation only",
    (source: HTMLElement) => translateNodeTranslationOnlyMode([source], "walk", DEFAULT_CONFIG),
  ],
] as const

describe.each(MODES)("%s mode records why a paragraph stays as it was", (_, translate) => {
  beforeEach(() => {
    document.body.replaceChildren()
    resetParagraphDiagnosis()
    mockShouldFilterSmallParagraph.mockReset().mockResolvedValue(false)
    mockShouldSkipAsTargetLanguage.mockReset().mockResolvedValue(false)
    mockTranslateTextForPage.mockReset().mockResolvedValue("Un paragraphe traduit")
  })

  afterEach(() => {
    removeAllTranslatedWrapperNodes(document)
  })

  function verdictOf(source: HTMLElement) {
    return getDiagnosedParagraphs().find(({ element }) => source.contains(element))?.verdict
  }

  it("records a translated paragraph", async () => {
    const source = createSource()
    await translate(source)
    expect(verdictOf(source)).toBe("translated")
  })

  it.each([
    ["too short", mockShouldFilterSmallParagraph, "tooShort"],
    ["already in the target language", mockShouldSkipAsTargetLanguage, "targetLanguage"],
  ])("records a paragraph skipped as %s, without sending it", async (__, filter, verdict) => {
    filter.mockResolvedValue(true)
    const source = createSource()

    await translate(source)

    expect(verdictOf(source)).toBe(verdict)
    expect(mockTranslateTextForPage).not.toHaveBeenCalled()
  })

  it("keeps the reason the translation step gave for an empty answer", async () => {
    mockTranslateTextForPage.mockImplementation(async (_text, _format, options) => {
      options?.diagnosis?.untranslated("noTranslationNeeded")
      return ""
    })
    const source = createSource()

    await translate(source)

    expect(verdictOf(source)).toBe("noTranslationNeeded")
  })

  it("records a failed request", async () => {
    mockTranslateTextForPage.mockRejectedValue(new Error("Service unavailable"))
    const source = createSource()

    await translate(source)

    expect(verdictOf(source)).toBe("error")
  })
})

describe("bilingual mode", () => {
  beforeEach(() => {
    document.body.replaceChildren()
    resetParagraphDiagnosis()
    mockShouldFilterSmallParagraph.mockReset().mockResolvedValue(false)
    mockShouldSkipAsTargetLanguage.mockReset().mockResolvedValue(false)
  })

  it("records a translation that only repeats the original", async () => {
    mockTranslateTextForPage.mockReset().mockResolvedValue(SOURCE_TEXT)
    const source = createSource()

    await translateNodesBilingualMode([source], "walk", DEFAULT_CONFIG)

    expect(getDiagnosedParagraphs()).toEqual([{ element: source, verdict: "sameAsSource" }])
  })
})
