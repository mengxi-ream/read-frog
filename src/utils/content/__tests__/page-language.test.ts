// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { detectPageLanguageLightweight, PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT } from "../page-language"

const { mockDetectLanguageWithSource } = vi.hoisted(() => ({
  mockDetectLanguageWithSource: vi.fn(),
}))

vi.mock("../language", () => ({
  detectLanguageWithSource: mockDetectLanguageWithSource,
}))

describe("detectPageLanguageLightweight", () => {
  beforeEach(() => {
    mockDetectLanguageWithSource.mockReset()
    mockDetectLanguageWithSource.mockResolvedValue({ code: "eng", source: "franc" })

    document.documentElement.removeAttribute("lang")
    document.head.innerHTML = ""
    document.title = ""
    document.body.innerHTML = ""
  })

  it("uses html lang metadata without invoking text language detection", async () => {
    document.documentElement.lang = "ja-JP"
    document.body.textContent = "This body should not be needed."

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "jpn",
      detectionSource: "metadata",
    })
    expect(mockDetectLanguageWithSource).not.toHaveBeenCalled()
  })

  it("uses page language meta tags before sampling body text", async () => {
    document.head.innerHTML = `<meta property="og:locale" content="zh_TW">`
    document.body.textContent = "This body should not be needed."

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "cmn-Hant",
      detectionSource: "metadata",
    })
    expect(mockDetectLanguageWithSource).not.toHaveBeenCalled()
  })

  it("falls back to local text detection with a bounded title and body sample", async () => {
    document.title = "A useful article title"
    document.body.innerHTML = `
      <main>
        <p>${"English body text. ".repeat(300)}</p>
        <script>const hidden = "ignored"</script>
      </main>
    `

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "eng",
      detectionSource: "franc",
    })
    expect(mockDetectLanguageWithSource).toHaveBeenCalledTimes(1)
    expect(mockDetectLanguageWithSource).toHaveBeenCalledWith(
      expect.stringContaining("A useful article title"),
      { enableLLM: false },
    )
    const [textForDetection] = mockDetectLanguageWithSource.mock.calls[0]
    expect(textForDetection).not.toContain("hidden")
    expect(textForDetection.length).toBeLessThanOrEqual(PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT + document.title.length + 2)
  })

  it("does not clone the document or read computed styles during initial detection", async () => {
    document.body.textContent = "English body text. ".repeat(20)
    const cloneSpy = vi.spyOn(document, "cloneNode")
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle")

    await detectPageLanguageLightweight()

    expect(cloneSpy).not.toHaveBeenCalled()
    expect(getComputedStyleSpy).not.toHaveBeenCalled()
  })

  it("returns und when local text detection cannot identify the page language", async () => {
    mockDetectLanguageWithSource.mockResolvedValueOnce({ code: "und", source: "fallback" })
    document.body.textContent = "hi"

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "und",
      detectionSource: "fallback",
    })
  })
})
