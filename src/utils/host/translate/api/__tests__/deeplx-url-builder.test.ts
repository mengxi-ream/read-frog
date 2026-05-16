import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildDeepLXUrl, deeplxTranslate } from "../deeplx"

const fetchMock = vi.fn()

describe("buildDeepLXUrl", () => {
  describe("token placeholder functionality", () => {
    it("replaces {{apiKey}} with API key in path", () => {
      const result = buildDeepLXUrl("https://api.deeplx.com/{{apiKey}}/translate", "abc123")
      expect(result).toBe("https://api.deeplx.com/abc123/translate")
    })

    it("replaces {{apiKey}} with API key as query parameter", () => {
      const result = buildDeepLXUrl("https://api.deeplx.com/v1/translate?token={{apiKey}}", "mykey")
      expect(result).toBe("https://api.deeplx.com/v1/translate?token=mykey")
    })

    it("replaces multiple {{apiKey}} occurrences", () => {
      const result = buildDeepLXUrl("https://{{apiKey}}.api.deeplx.com/{{apiKey}}/translate", "test")
      expect(result).toBe("https://test.api.deeplx.com/test/translate")
    })

    it("trims API key only when replacing placeholders", () => {
      const result = buildDeepLXUrl("https://api.deeplx.com/{{apiKey}}/translate", "  abc123  ")
      expect(result).toBe("https://api.deeplx.com/abc123/translate")
    })

    it("throws error when {{apiKey}} is used without API key", () => {
      expect(() => buildDeepLXUrl("https://api.deeplx.com/{{apiKey}}/translate")).toThrow(
        "API key is required when using {{apiKey}} placeholder in DeepLX baseURL",
      )
      expect(() => buildDeepLXUrl("https://api.deeplx.com/{{apiKey}}/translate", "   ")).toThrow(
        "API key is required when using {{apiKey}} placeholder in DeepLX baseURL",
      )
    })
  })

  describe("explicit URL handling", () => {
    it("returns baseURL unchanged when it has no placeholder", () => {
      expect(buildDeepLXUrl("https://deeplx.vercel.app")).toBe("https://deeplx.vercel.app")
      expect(buildDeepLXUrl("https://deeplx.vercel.app/")).toBe("https://deeplx.vercel.app/")
      expect(buildDeepLXUrl("https://api.deeplx.org", "token123")).toBe("https://api.deeplx.org")
      expect(buildDeepLXUrl("https://api.example.com/v1/translate?token=abc/")).toBe("https://api.example.com/v1/translate?token=abc/")
    })

    it("does not append /translate after placeholder replacement", () => {
      const result = buildDeepLXUrl("https://api.deeplx.com/{{apiKey}}", "abc123")
      expect(result).toBe("https://api.deeplx.com/abc123")
    })
  })
})

describe("deeplxTranslate default URL fallback", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({ data: "你好" }),
      text: vi.fn().mockResolvedValue(""),
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the default DeepLX placeholder URL when baseURL is missing", async () => {
    const result = await deeplxTranslate("Hi", "auto", "zh", {
      id: "deeplx-default",
      enabled: true,
      name: "DeepLX",
      provider: "deeplx",
      apiKey: "token123",
    })

    expect(result).toBe("你好")
    expect(fetchMock).toHaveBeenCalledWith("https://api.deeplx.org/token123/translate", expect.objectContaining({
      method: "POST",
    }))
  })

  it("throws the placeholder API key error when fallback URL needs a missing key", async () => {
    await expect(deeplxTranslate("Hi", "auto", "zh", {
      id: "deeplx-default",
      enabled: true,
      name: "DeepLX",
      provider: "deeplx",
    })).rejects.toThrow("API key is required when using {{apiKey}} placeholder in DeepLX baseURL")

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
