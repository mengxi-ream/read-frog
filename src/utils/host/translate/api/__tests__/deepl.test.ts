import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deeplTranslate, deeplTranslateBatch, getDeepLBaseURL } from "../deepl"

const fetchMock = vi.fn()

describe("deepl translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("detects the free API base URL from :fx keys", () => {
    expect(getDeepLBaseURL("test-key:fx")).toBe("https://api-free.deepl.com")
    expect(getDeepLBaseURL("test-key")).toBe("https://api.deepl.com")
    expect(getDeepLBaseURL("test-key:fx", "https://proxy.example.com/")).toBe("https://proxy.example.com")
  })

  it("sends a single-item request as a one-element text array and omits source_lang for auto", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        translations: [{ text: "你好" }],
      }),
      text: vi.fn().mockResolvedValue(""),
    })

    const result = await deeplTranslate("Hello", "auto", "zh", {
      id: "deepl-default",
      enabled: true,
      name: "DeepL",
      provider: "deepl",
      apiKey: "test-key:fx",
    })

    expect(result).toBe("你好")
    expect(fetchMock).toHaveBeenCalledWith("https://api-free.deepl.com/v2/translate", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Authorization": "DeepL-Auth-Key test-key:fx",
        "Content-Type": "application/json",
      }),
    }))

    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body)).toEqual({
      text: ["Hello"],
      target_lang: "ZH-HANS",
    })
  })

  it("uses native batch requests and maps zh-TW to ZH-HANT", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        translations: [{ text: "甲" }, { text: "乙" }],
      }),
      text: vi.fn().mockResolvedValue(""),
    })

    const result = await deeplTranslateBatch(["A", "B"], "en", "zh-TW", {
      id: "deepl-default",
      enabled: true,
      name: "DeepL",
      provider: "deepl",
      apiKey: "test-key",
    })

    expect(result).toEqual(["甲", "乙"])
    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body)).toEqual({
      text: ["A", "B"],
      source_lang: "EN",
      target_lang: "ZH-HANT",
    })
  })

  it("normalizes zh-TW source language to ZH", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        translations: [{ text: "A" }],
      }),
      text: vi.fn().mockResolvedValue(""),
    })

    await deeplTranslate("甲", "zh-TW", "en", {
      id: "deepl-default",
      enabled: true,
      name: "DeepL",
      provider: "deepl",
      apiKey: "test-key",
    })

    const [, requestInit] = fetchMock.mock.calls[0]
    expect(JSON.parse(requestInit.body)).toEqual({
      text: ["甲"],
      source_lang: "ZH",
      target_lang: "EN",
    })
  })

  it("splits requests into chunks of 50 texts when batch size exceeds DeepL limits", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          translations: Array.from({ length: 50 }, (_, index) => ({ text: `chunk1-${index}` })),
        }),
        text: vi.fn().mockResolvedValue(""),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn().mockResolvedValue({
          translations: Array.from({ length: 5 }, (_, index) => ({ text: `chunk2-${index}` })),
        }),
        text: vi.fn().mockResolvedValue(""),
      })

    const result = await deeplTranslateBatch(
      Array.from({ length: 55 }, (_, index) => `Text ${index}`),
      "en",
      "de",
      {
        id: "deepl-default",
        enabled: true,
        name: "DeepL",
        provider: "deepl",
        apiKey: "test-key",
      },
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toHaveLength(50)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).text).toHaveLength(5)
    expect(result).toHaveLength(55)
    expect(result[0]).toBe("chunk1-0")
    expect(result[54]).toBe("chunk2-4")
  })

  it("throws when the response count does not match the request count", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        translations: [{ text: "only-one" }],
      }),
      text: vi.fn().mockResolvedValue(""),
    })

    await expect(deeplTranslateBatch(["A", "B"], "en", "de", {
      id: "deepl-default",
      enabled: true,
      name: "DeepL",
      provider: "deepl",
      apiKey: "test-key",
    })).rejects.toThrow("DeepL translation response count mismatch")
  })
})
