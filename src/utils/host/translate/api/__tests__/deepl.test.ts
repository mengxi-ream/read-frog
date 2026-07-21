import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  deeplTranslate,
  getDeepLBaseURL,
  parseDeepLApiKeys,
  resetDeepLKeyRoundRobinIndex,
  serializeDeepLApiKeys,
} from "../deepl"

const fetchMock = vi.fn<(...args: any[]) => any>()

function mockOkTranslation(text = "ok") {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn<(...args: any[]) => any>().mockResolvedValue({
      translations: [{ text }],
    }),
    text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
  })
}

const deeplConfig = (apiKey?: string) =>
  ({
    id: "deepl-default",
    enabled: true,
    name: "DeepL",
    provider: "deepl" as const,
    apiKey,
  }) as const

describe("deepl translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    resetDeepLKeyRoundRobinIndex()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("detects the free API base URL from :fx keys", () => {
    expect(getDeepLBaseURL("test-key:fx")).toBe("https://api-free.deepl.com")
    expect(getDeepLBaseURL("test-key")).toBe("https://api.deepl.com")
  })

  it("parses and serializes newline-separated keys", () => {
    expect(parseDeepLApiKeys(undefined)).toEqual([])
    expect(parseDeepLApiKeys("")).toEqual([])
    expect(parseDeepLApiKeys("   \n  ")).toEqual([])
    expect(parseDeepLApiKeys("a")).toEqual(["a"])
    expect(parseDeepLApiKeys("a\nb")).toEqual(["a", "b"])
    expect(parseDeepLApiKeys(" a \r\n\n b \n")).toEqual(["a", "b"])
    expect(serializeDeepLApiKeys([" a ", "", "b "])).toBe("a\nb")
  })

  it("sends a single-item request as a one-element text array and omits source_lang for auto", async () => {
    mockOkTranslation("你好")

    const result = await deeplTranslate("Hello", "auto", "zh", deeplConfig("test-key:fx"))

    expect(result).toBe("你好")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api-free.deepl.com/v2/translate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "DeepL-Auth-Key test-key:fx",
          "Content-Type": "application/json",
        }),
      }),
    )

    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body)).toEqual({
      text: ["Hello"],
      target_lang: "ZH-HANS",
    })
  })

  it("normalizes zh-TW source language to ZH", async () => {
    mockOkTranslation("A")

    await deeplTranslate("甲", "zh-TW", "en", deeplConfig("test-key"))

    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body)).toEqual({
      text: ["甲"],
      source_lang: "ZH",
      target_lang: "EN",
    })
  })

  it.each(["plain", undefined] as const)(
    "omits tag_handling for %s text format",
    async (textFormat) => {
      mockOkTranslation("Hello")

      await deeplTranslate("Hello", "en", "de", deeplConfig("test-key"), { textFormat })

      const [, requestInit] = fetchMock.mock.calls[0]
      expect(JSON.parse(requestInit.body)).toEqual({
        text: ["Hello"],
        source_lang: "EN",
        target_lang: "DE",
      })
    },
  )

  it("sets tag_handling to html for html input", async () => {
    mockOkTranslation("<p>Hallo</p>")

    await deeplTranslate('<p class="message">Hello</p>', "en", "de", deeplConfig("test-key"), {
      textFormat: "html",
    })

    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body)).toEqual({
      text: ['<p class="message">Hello</p>'],
      source_lang: "EN",
      target_lang: "DE",
      tag_handling: "html",
    })
  })

  it("throws when the response count does not match the request count", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn<(...args: any[]) => any>().mockResolvedValue({
        translations: [],
      }),
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
    })

    await expect(deeplTranslate("A", "en", "de", deeplConfig("test-key"))).rejects.toThrow(
      "DeepL translation response count mismatch",
    )
  })

  it("throws when no API key is configured", async () => {
    await expect(deeplTranslate("A", "en", "de", deeplConfig(undefined))).rejects.toThrow(
      "DeepL API key is not configured",
    )
    await expect(deeplTranslate("A", "en", "de", deeplConfig("  \n  "))).rejects.toThrow(
      "DeepL API key is not configured",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("round-robins multi-keys and derives baseURL from the selected key", async () => {
    mockOkTranslation("1")
    mockOkTranslation("2")
    mockOkTranslation("3")

    const config = deeplConfig("k1:fx\nk2")

    await deeplTranslate("A", "en", "de", config)
    await deeplTranslate("B", "en", "de", config)
    await deeplTranslate("C", "en", "de", config)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toBe("https://api-free.deepl.com/v2/translate")
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("DeepL-Auth-Key k1:fx")
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.deepl.com/v2/translate")
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("DeepL-Auth-Key k2")
    expect(fetchMock.mock.calls[2][0]).toBe("https://api-free.deepl.com/v2/translate")
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("DeepL-Auth-Key k1:fx")
  })

  it("keeps round-robin state per provider so one-key pools do not reset multi-key pools", async () => {
    mockOkTranslation("1")
    mockOkTranslation("2")
    mockOkTranslation("3")
    mockOkTranslation("4")

    const multi = {
      ...deeplConfig("k1:fx\nk2"),
      id: "deepl-multi",
    } as const
    const single = {
      ...deeplConfig("solo"),
      id: "deepl-single",
    } as const

    await deeplTranslate("A", "en", "de", multi) // multi -> k1
    await deeplTranslate("B", "en", "de", single) // single -> solo (must not reset multi)
    await deeplTranslate("C", "en", "de", multi) // multi -> k2
    await deeplTranslate("D", "en", "de", multi) // multi -> k1

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("DeepL-Auth-Key k1:fx")
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("DeepL-Auth-Key solo")
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("DeepL-Auth-Key k2")
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe("DeepL-Auth-Key k1:fx")
  })

  it("does not failover to the next key within the same request", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue("quota"),
      json: vi.fn<(...args: any[]) => any>(),
    })

    await expect(deeplTranslate("A", "en", "de", deeplConfig("k1\nk2"))).rejects.toThrow(
      "DeepL translation request failed: 403",
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("DeepL-Auth-Key k1")
  })
})
