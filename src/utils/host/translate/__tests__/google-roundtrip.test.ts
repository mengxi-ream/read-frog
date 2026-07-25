import { decodeHTML, escapeText } from "entities"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { executeTranslate } from "../execute-translate"

// Integration coverage for the escape -> translateHtml -> decode pipeline. The
// fetch stub emulates the endpoint's observed identity-translation behavior:
// input is parsed as HTML — an unescaped tag-open swallows the rest of the
// string (live behavior for "<b then stop") and entities (including legacy
// semicolon-less ones such as "&copy") are resolved — then the resulting plain
// text is re-serialized as escaped HTML. executeTranslate must therefore return
// the original plain text byte-for-byte only when the request was escaped.
function simulateTranslateHtmlEndpoint(requestText: string): string {
  const withoutBogusTag = requestText.replace(/<[a-z][\s\S]*$/i, "")
  return escapeText(decodeHTML(withoutBogusTag))
}

const fetchMock = vi.fn<(...args: any[]) => any>()

const langConfig = {
  sourceCode: "eng" as const,
  targetCode: "cmn" as const,
  detectedCode: "eng" as const,
  level: "intermediate" as const,
}

const googleProviderConfig = {
  id: "google-translate-default",
  enabled: true,
  name: "Google Translate",
  provider: "google-translate" as const,
}

describe("google translate escape/decode round trip", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init: { body: string }) => {
      const requestText = JSON.parse(init.body)[0][0][0]
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [[simulateTranslateHtmlEndpoint(requestText)]],
        text: async () => "",
      })
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ["tag-like text is not truncated", "if x <b then stop"],
    ["URL query params survive intact", "访问 https://example.com/?page=1&copy=true 查看详情"],
    ["literal entity mentions survive intact", "write &amp; for ampersand"],
    ["apostrophes and quotes survive intact", `It's called "Read Frog"`],
  ])("%s", async (_name, text) => {
    const result = await executeTranslate(text, langConfig, googleProviderConfig, vi.fn())

    expect(result).toBe(text)
  })
})
