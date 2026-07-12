import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { microsoftTranslate } from "../microsoft"

const fetchMock = vi.fn<(...args: any[]) => any>()

describe("microsoft translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
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
          .mockResolvedValue([{ translations: [{ text: "你好" }] }]),
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

  it("requests plain textType so tag-like text is translated instead of skipped", async () => {
    const result = await microsoftTranslate("if x <b then stop", "en", "zh")

    expect(result).toBe("你好")
    expect(translateCallURL()).toContain("textType=plain")
    expect(translateCallURL()).not.toContain("textType=html")
  })

  it("requests html textType for html-format input so markup is preserved", async () => {
    await microsoftTranslate('See the <a href="/pricing">pricing</a>', "en", "zh", {
      textFormat: "html",
    })

    expect(translateCallURL()).toContain("textType=html")
  })
})
