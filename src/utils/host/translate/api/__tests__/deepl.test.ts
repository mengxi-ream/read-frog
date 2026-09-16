import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deeplTranslate, getDeepLBaseURL } from "../deepl"

const fetchMock = vi.fn<(...args: any[]) => any>()

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
      json: vi.fn<(...args: any[]) => any>().mockResolvedValue({
        translations: [{ text: "你好" }],
      }),
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
    })

    const result = await deeplTranslate("Hello", "auto", "zh", {
      id: "deepl-default",
      enabled: true,
      name: "DeepL",
      provider: "deepl",
      apiKey: "test-key:fx",
    })

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

    const [, requestInit] = fetchMock.mock.calls[0]!
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
      json: vi.fn<(...args: any[]) => any>().mockResolvedValue({
        translations: [{ text: "A" }],
      }),
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
    })

    await deeplTranslate("甲", "zh-TW", "en", {
      id: "deepl-default",
      enabled: true,
      name: "DeepL",
      provider: "deepl",
      apiKey: "test-key",
    })

    const [, requestInit] = fetchMock.mock.calls[0]!
    expect(JSON.parse(requestInit.body)).toEqual({
      text: ["甲"],
      source_lang: "ZH",
      target_lang: "EN",
    })
  })

  it.each([
    { qualityOptimized: undefined, textFormat: "plain", apiKey: "test-key" },
    { qualityOptimized: false, textFormat: "plain", apiKey: "test-key" },
    { qualityOptimized: true, textFormat: "plain", apiKey: "test-key" },
    { qualityOptimized: true, textFormat: "html", apiKey: "test-key" },
    { qualityOptimized: true, textFormat: "plain", apiKey: "test-key:fx" },
  ] as const)(
    "uses qualityOptimized=$qualityOptimized for $textFormat input with $apiKey",
    async ({ qualityOptimized, textFormat, apiKey }) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ translations: [{ text: "Hallo" }] }),
      })
      const signal = new AbortController().signal
      const text = textFormat === "html" ? "<p>Hello</p>" : "Hello"

      expect(
        await deeplTranslate(
          text,
          "auto",
          "de",
          {
            id: "deepl-default",
            enabled: true,
            name: "DeepL",
            provider: "deepl",
            apiKey,
            providerSpecificSettings: { qualityOptimized },
          },
          { textFormat, signal },
        ),
      ).toBe("Hallo")

      const [url, requestInit] = fetchMock.mock.calls[0]!
      expect(url).toBe(`${getDeepLBaseURL(apiKey)}/v2/translate`)
      expect(requestInit.signal).toBe(signal)
      const body = JSON.parse(requestInit.body)
      expect(body).toEqual({
        text: [text],
        target_lang: "DE",
        ...(qualityOptimized ? { model_type: "quality_optimized" } : {}),
        ...(textFormat === "html" ? { tag_handling: "html" } : {}),
      })
    },
  )

  it.each(["plain", undefined] as const)(
    "omits tag_handling for %s text format",
    async (textFormat) => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn<(...args: any[]) => any>().mockResolvedValue({
          translations: [{ text: "Hello" }],
        }),
        text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
      })

      await deeplTranslate(
        "Hello",
        "en",
        "de",
        {
          id: "deepl-default",
          enabled: true,
          name: "DeepL",
          provider: "deepl",
          apiKey: "test-key",
        },
        { textFormat },
      )

      const [, requestInit] = fetchMock.mock.calls[0]!
      expect(JSON.parse(requestInit.body)).toEqual({
        text: ["Hello"],
        source_lang: "EN",
        target_lang: "DE",
      })
    },
  )

  it("sets tag_handling to html for html input", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn<(...args: any[]) => any>().mockResolvedValue({
        translations: [{ text: "<p>Hallo</p>" }],
      }),
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
    })

    await deeplTranslate(
      '<p class="message">Hello</p>',
      "en",
      "de",
      {
        id: "deepl-default",
        enabled: true,
        name: "DeepL",
        provider: "deepl",
        apiKey: "test-key",
      },
      { textFormat: "html" },
    )

    const [, requestInit] = fetchMock.mock.calls[0]!
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

    await expect(
      deeplTranslate("A", "en", "de", {
        id: "deepl-default",
        enabled: true,
        name: "DeepL",
        provider: "deepl",
        apiKey: "test-key",
      }),
    ).rejects.toThrow("DeepL translation response count mismatch")
  })
})
