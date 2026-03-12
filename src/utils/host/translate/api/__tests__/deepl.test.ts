import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deeplTranslate, getDeepLBaseURL } from "../deepl"

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

  it("throws when the response count does not match the request count", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        translations: [],
      }),
      text: vi.fn().mockResolvedValue(""),
    })

    await expect(deeplTranslate("A", "en", "de", {
      id: "deepl-default",
      enabled: true,
      name: "DeepL",
      provider: "deepl",
      apiKey: "test-key",
    })).rejects.toThrow("DeepL translation response count mismatch")
  })
})
