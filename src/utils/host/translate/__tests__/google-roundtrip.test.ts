import { decodeHTML, escapeText } from "entities"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { executeTranslate } from "../execute-translate"

// Integration coverage for the escape -> translateHtml -> decode pipeline. The
// fetch stub emulates the endpoint's observed identity-translation behavior:
// input is parsed as HTML — an unescaped tag-open swallows the rest of the
// string (live behavior for "<b then stop"), entities (including legacy
// semicolon-less ones such as "&copy") are resolved, literal newlines collapse
// as HTML whitespace, leading indentation collapses too, and the model strips
// leading dash-family list bullets (worst case: from EVERY item) — then the
// resulting plain text is re-serialized as escaped HTML. executeTranslate must
// therefore return the original text byte-for-byte only when the request was
// escaped and, for multi-line text, split into per-line items with indentation
// and bullet prefixes extracted client-side.
function simulateTranslateHtmlEndpoint(requestText: string): string {
  const withoutBogusTag = requestText.replace(/<[a-z][\s\S]*$/i, "")
  return (
    escapeText(decodeHTML(withoutBogusTag))
      // Newlines and leading indentation are HTML whitespace to the parser.
      .replace(/[^\S\r\n]*[\r\n]\s*/g, " ")
      .replace(/^[ \t]+/, "")
      // The model eats leading list dashes (live-observed on x.com bullets).
      .replace(/^[-–—•·▪◦‣⁃*][ \t]+/, "")
  )
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
      const requestTexts: string[] = JSON.parse(init.body)[0][0]
      // The endpoint rejects empty batch items.
      if (requestTexts.some((text) => text === "")) {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({}),
          text: async () => "empty batch item",
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [requestTexts.map((text) => simulateTranslateHtmlEndpoint(text))],
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

  it("collapses newlines without preserveLineBreaks (endpoint behavior)", async () => {
    const result = await executeTranslate(
      "- Organic\n- SEO\n- Paid Ads",
      langConfig,
      googleProviderConfig,
      vi.fn(),
    )

    // The simulator also emulates the model eating the leading list dash —
    // without the flag nothing protects it. The point here: lines collapse.
    expect(result).toBe("Organic - SEO - Paid Ads")
  })

  it.each([
    ["single newlines (bullet lists)", "- Organic\n- SEO\n- Paid Ads"],
    ["blank-line paragraphs", "First paragraph\n\nSecond paragraph"],
    ["CRLF line endings", "First\r\nSecond"],
    ["mixed blank lines and single breaks", "Title\n\n- a\n- b\n\nOutro"],
    ["unicode bullets and indentation", "• first\n  – second level\nplain"],
    ["numbered list lines", "1. Find a face\n2. Craft a series\n3. Multiply accounts"],
    ["negative numbers keep their sign", "-5°C outside\n-3 points"],
    ["tag-like text on its own line", "if x <b then stop\nsecond line"],
  ])("preserves %s with preserveLineBreaks", async (_name, text) => {
    const result = await executeTranslate(text, langConfig, googleProviderConfig, vi.fn(), {
      preserveLineBreaks: true,
    })

    expect(result).toBe(text.replace(/\r\n?/g, "\n"))
  })

  it("sends each non-empty line as its own item, bullet kept for context", async () => {
    await executeTranslate("- alpha\n\n  • beta", langConfig, googleProviderConfig, vi.fn(), {
      preserveLineBreaks: true,
    })

    const requestTexts = JSON.parse(fetchMock.mock.calls.at(-1)![1].body)[0][0]
    expect(requestTexts).toEqual(["- alpha", "• beta"])
  })

  it("uses the page-level detected language instead of per-item auto", async () => {
    await executeTranslate(
      "- SEO\n- Paid Ads",
      { ...langConfig, sourceCode: "auto" },
      googleProviderConfig,
      vi.fn(),
      { preserveLineBreaks: true, detectedSourceCode: "eng" },
    )

    const sourceLang = JSON.parse(fetchMock.mock.calls.at(-1)![1].body)[0][1]
    expect(sourceLang).toBe("en")
  })

  it("normalizes a model-restyled bullet back to the source prefix", async () => {
    // The simulator eats the bullet; reassembly must restore the source's own.
    const result = await executeTranslate(
      "• kept bullet\n- kept dash",
      langConfig,
      googleProviderConfig,
      vi.fn(),
      {
        preserveLineBreaks: true,
      },
    )

    expect(result).toBe("• kept bullet\n- kept dash")
  })
})
