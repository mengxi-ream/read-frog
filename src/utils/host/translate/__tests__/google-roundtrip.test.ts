import { decodeHTML, escapeText } from "entities"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { executeTranslate } from "../execute-translate"

// Integration coverage for the escape -> translateHtml -> decode pipeline. The
// fetch stub emulates the endpoint's observed identity-translation behavior:
// input is parsed as HTML — an unescaped tag-open swallows the rest of the
// string (live behavior for "<b then stop"), entities (including legacy
// semicolon-less ones such as "&copy") are resolved, literal newlines collapse
// as HTML whitespace, line-break marker tags survive as tags, and within each
// marker-delimited segment leading indentation collapses and the model strips
// a leading dash-family list bullet (worst case: from EVERY segment) — then
// the resulting plain text is re-serialized as escaped HTML. executeTranslate
// must therefore return the original text byte-for-byte only when the request
// was escaped and, for multi-line text, marker-joined with indentation and
// bullet prefixes captured client-side.
const LINE_BREAK_MARKER = '<br data-read-frog-lb="1">'

function simulateTranslateHtmlEndpoint(requestText: string): string {
  return requestText
    .split(LINE_BREAK_MARKER)
    .map((segment) => {
      const withoutBogusTag = segment.replace(/<[a-z][\s\S]*$/i, "")
      return (
        escapeText(decodeHTML(withoutBogusTag))
          // Newlines and leading indentation are HTML whitespace to the parser.
          .replace(/[^\S\r\n]*[\r\n]\s*/g, " ")
          .replace(/^[ \t]+/, "")
          // The model eats leading list dashes (live-observed on x.com bullets;
          // a bullet-only segment "- " comes back as a bare "-").
          .replace(/^[-–—•·▪◦‣⁃*][ \t]+(?=[^ \t])/, "")
          .replace(/^[-–—•·▪◦‣⁃*][ \t]+$/, "-")
      )
    })
    .join(LINE_BREAK_MARKER)
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
      // The endpoint rejects empty batch items; the marker transport must
      // always send exactly one non-empty item.
      if (requestTexts.length !== 1 || requestTexts[0] === "") {
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({}),
          text: async () => "invalid batch",
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [[simulateTranslateHtmlEndpoint(requestTexts[0]!)]],
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
    // Bullet shape from https://x.com/davidjpark96/status/1789773192435060737
    ["single newlines (bullet lists)", "- Organic\n- SEO\n- Paid Ads"],
    ["blank-line paragraphs", "First paragraph\n\nSecond paragraph"],
    ["CRLF line endings", "First\r\nSecond"],
    ["mixed blank lines and single breaks", "Title\n\n- a\n- b\n\nOutro"],
    ["unicode bullets and indentation", "• first\n  – second level\nplain"],
    ["numbered list lines", "1. Find a face\n2. Craft a series\n3. Multiply accounts"],
    ["negative numbers keep their sign", "-5°C outside\n-3 points"],
    ["tag-like text on its own line", "if x <b then stop\nsecond line"],
    // Plain-line shape from https://x.com/EpsteinJeffrey0/status/2083709421386080579
    // — a tweet of consecutive single-"\n" lines with no blank-line separators.
    [
      "plain single-newline tweet lines",
      "The first statement stands alone\nThe second makes a related point\nWhy? Because this line asks a question",
    ],
  ])("preserves %s with preserveLineBreaks", async (_name, text) => {
    const result = await executeTranslate(text, langConfig, googleProviderConfig, vi.fn(), {
      preserveLineBreaks: true,
    })

    expect(result).toBe(text.replace(/\r\n?/g, "\n"))
  })

  it("sends ONE marker-joined item so the endpoint detects the whole unit", async () => {
    // Whole-unit transport is a correctness invariant: per-line items are
    // language-detected independently and short lines misread ("- SEO" alone
    // with sl=auto -> "- 这"). The source language must stay untouched.
    await executeTranslate(
      "- alpha\n\n  • beta",
      { ...langConfig, sourceCode: "auto" as const },
      googleProviderConfig,
      vi.fn(),
      { preserveLineBreaks: true },
    )

    const [payload] = JSON.parse(fetchMock.mock.calls.at(-1)![1].body)
    expect(payload[0]).toEqual([
      `- alpha${LINE_BREAK_MARKER}${LINE_BREAK_MARKER}${LINE_BREAK_MARKER}${LINE_BREAK_MARKER}• beta`,
    ])
    expect(payload[1]).toBe("auto")
  })

  it("keeps a bullet-only line without doubling its dash", async () => {
    const result = await executeTranslate("- \nhello", langConfig, googleProviderConfig, vi.fn(), {
      preserveLineBreaks: true,
    })

    expect(result).toBe("- \nhello")
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
