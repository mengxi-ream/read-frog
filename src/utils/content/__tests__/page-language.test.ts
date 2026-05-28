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

  it("uses html lang metadata without invoking text language detection when text is short", async () => {
    document.documentElement.lang = "ja-JP"
    document.body.textContent = "This body should not be needed."

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "jpn",
      detectionSource: "metadata",
    })
    expect(mockDetectLanguageWithSource).not.toHaveBeenCalled()
  })

  it("uses page language meta tags without invoking text language detection when text is short", async () => {
    document.head.innerHTML = `<meta property="og:locale" content="zh_TW">`
    document.body.textContent = "This body should not be needed."

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "cmn-Hant",
      detectionSource: "metadata",
    })
    expect(mockDetectLanguageWithSource).not.toHaveBeenCalled()
  })

  it("prefers Chinese text detection over conflicting English metadata", async () => {
    mockDetectLanguageWithSource.mockResolvedValueOnce({ code: "cmn", source: "franc" })
    document.documentElement.lang = "en"
    document.title = "阅读 - 源仓库"
    document.body.textContent = "源仓库 资源中心 文章列表 地址发布页 首页 阅读 登录 阅读 书源 书源合集 订阅源 订阅源合集 其他 新建".repeat(2)

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "cmn",
      detectionSource: "franc",
    })
    expect(mockDetectLanguageWithSource).toHaveBeenCalledWith(
      expect.stringContaining("阅读 - 源仓库"),
      { enableLLM: false },
    )
  })

  it("prefers text detection over conflicting non-English metadata", async () => {
    mockDetectLanguageWithSource.mockResolvedValueOnce({ code: "eng", source: "franc" })
    document.documentElement.lang = "ja-JP"
    document.body.textContent = "English body text with enough visible content to verify incorrect page metadata. ".repeat(2)

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "eng",
      detectionSource: "franc",
    })
  })

  it("keeps English metadata when text detection agrees", async () => {
    mockDetectLanguageWithSource.mockResolvedValueOnce({ code: "eng", source: "franc" })
    document.documentElement.lang = "en"
    document.body.textContent = "English body text with enough visible content to verify matching page metadata. ".repeat(2)

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "eng",
      detectionSource: "metadata",
    })
  })

  it("keeps traditional Chinese metadata when text detection returns generic Chinese", async () => {
    mockDetectLanguageWithSource.mockResolvedValueOnce({ code: "cmn", source: "franc" })
    document.head.innerHTML = `<meta property="og:locale" content="zh_TW">`
    document.body.textContent = "繁體中文內容用來驗證頁面語言中繼資料，這段文字需要足夠長，避免短文本時跳過正文偵測。".repeat(2)

    const result = await detectPageLanguageLightweight()

    expect(result).toEqual({
      detectedCodeOrUnd: "cmn-Hant",
      detectionSource: "metadata",
    })
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
