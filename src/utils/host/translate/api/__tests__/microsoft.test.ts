import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { microsoftTranslate } from "../microsoft"

const fetchMock = vi.fn<(...args: any[]) => any>()
let translatedText = "你好"

describe("microsoft translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    translatedText = "你好"
    fetchMock.mockImplementation((url: string) => {
      if (url === "https://edge.microsoft.com/translate/auth") {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: vi.fn<(...args: any[]) => any>().mockResolvedValue("test-token"),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi
          .fn<(...args: any[]) => any>()
          .mockImplementation(async () => [{ translations: [{ text: translatedText }] }]),
        text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
      })
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function translateCallURL(): string {
    const translateCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("microsofttranslator.com/translate"),
    )
    expect(translateCall).toBeDefined()
    return String(translateCall![0])
  }

  function sentTranslationText(): string {
    const translateCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("microsofttranslator.com/translate"),
    )
    expect(translateCall).toBeDefined()
    return JSON.parse(translateCall![1].body)[0].Text
  }

  it("requests plain textType so tag-like text is translated instead of skipped", async () => {
    const result = await microsoftTranslate("if x <b then stop", "en", "zh")

    expect(result).toBe("你好")
    expect(translateCallURL()).toContain("textType=plain")
    expect(translateCallURL()).not.toContain("textType=html")
  })

  it("requests html textType for html-format input so markup is preserved", async () => {
    const source = 'See the <a data-rf-attr="0">pricing &amp; plans</a>'
    translatedText = '查看<a data-rf-attr="0">价格与方案</a>'

    const result = await microsoftTranslate(source, "en", "zh", {
      textFormat: "html",
    })

    expect(translateCallURL()).toContain("textType=html")
    expect(sentTranslationText()).toBe(source)
    expect(result).toBe(translatedText)
  })
})
