import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { googleTranslate } from "../google"

const fetchMock = vi.fn<(...args: any[]) => any>()

function mockTranslateResponse(translation: string) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn<(...args: any[]) => any>().mockResolvedValue([[translation]]),
    text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
  })
}

function sentSourceText(): string {
  const [, requestInit] = fetchMock.mock.calls[0]!
  return JSON.parse(requestInit.body)[0][0][0]
}

describe("google translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("escapes < and > so tag-like text is not swallowed by the HTML endpoint", async () => {
    mockTranslateResponse("如果 x &lt;b 则停止")

    await googleTranslate("if x <b then stop", "en", "zh")

    expect(sentSourceText()).toBe("if x &lt;b then stop")
  })

  it("escapes & so URL query params are not parsed as legacy entities", async () => {
    mockTranslateResponse("ok")

    await googleTranslate("访问 https://example.com/?page=1&copy=true 查看详情", "zh-CN", "en")

    expect(sentSourceText()).toBe("访问 https://example.com/?page=1&amp;copy=true 查看详情")
  })

  it("escapes literal entity mentions so they survive the round trip", async () => {
    mockTranslateResponse("ok")

    await googleTranslate("write &amp; for < and >", "en", "zh")

    expect(sentSourceText()).toBe("write &amp;amp; for &lt; and &gt;")
  })

  it("sends html-format input unescaped so the endpoint preserves its tags", async () => {
    // translationOnly page mode sends outerHTML fragments and re-renders the
    // result via innerHTML — escaping them would expose tags to translation.
    const source = 'See the <a data-rf-attr="0">docs &amp; API</a>'
    const translated = '请参阅<a data-rf-attr="0">文档 &amp; API</a>'
    mockTranslateResponse(translated)

    const result = await googleTranslate(source, "en", "zh", {
      textFormat: "html",
    })

    expect(sentSourceText()).toBe(source)
    expect(result).toBe(translated)
  })

  describe("preserveLineBreaks with html-format input", () => {
    const MARKER_PAIR = '<br data-read-frog-lb="1">'.repeat(2)

    it("swaps only text-content newlines for markers and sends the markup unescaped", async () => {
      mockTranslateResponse("ok")

      await googleTranslate(
        '<a data-rf-attr="0" title="two\nlines">Tom &amp; Jerry\nguide</a>\nNext line',
        "en",
        "zh",
        { textFormat: "html", preserveLineBreaks: true },
      )

      // The newline inside the attribute value is not line structure.
      expect(sentSourceText()).toBe(
        `<a data-rf-attr="0" title="two\nlines">Tom &amp; Jerry${MARKER_PAIR}guide</a>${MARKER_PAIR}Next line`,
      )
    })

    it("restores each line with the source's indentation and bullet", async () => {
      // Shape of a GameFAQs guide's version-history banner. The model collapses
      // the indentation and eats the bullet, as it does for plain text.
      mockTranslateResponse(
        [
          "=====",
          "---[版本历史]---",
          "=====",
          "2012年1月22日",
          "<b>最终</b>版本",
          '<a data-rf-attr="0">链接</a>',
        ].join(MARKER_PAIR),
      )

      const result = await googleTranslate(
        [
          "=====",
          "---[VERSION HISTORY]---",
          "=====",
          "    January 22, 2012",
          "- <b>Final</b> version",
          '<a data-rf-attr="0">Link</a>',
        ].join("\n"),
        "en",
        "zh",
        { textFormat: "html", preserveLineBreaks: true },
      )

      expect(result).toBe(
        [
          "=====",
          "---[版本历史]---",
          "=====",
          "    2012年1月22日",
          "- <b>最终</b>版本",
          '<a data-rf-attr="0">链接</a>',
        ].join("\n"),
      )
    })

    it("keeps a newline inside an element as a line break of that element", async () => {
      mockTranslateResponse(`<b>标题${MARKER_PAIR}副标题</b>`)

      const result = await googleTranslate("<b>Title\nSubtitle</b>", "en", "zh", {
        textFormat: "html",
        preserveLineBreaks: true,
      })

      expect(sentSourceText()).toBe(`<b>Title${MARKER_PAIR}Subtitle</b>`)
      expect(result).toBe("<b>标题\n副标题</b>")
    })
  })

  it("returns the HTML-encoded API payload without decoding it", async () => {
    // Decoding happens exactly once, in executeTranslate via normalizeTranslationOutput.
    mockTranslateResponse("It&#39;s")

    await expect(googleTranslate("это", "ru", "en")).resolves.toBe("It&#39;s")
  })

  it("throws on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: new Map(),
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue("rate limited"),
    })

    await expect(googleTranslate("hello", "en", "zh")).rejects.toThrow(
      "Translation request failed: 429",
    )
  })

  it("throws on an unexpected response shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn<(...args: any[]) => any>().mockResolvedValue({ unexpected: true }),
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
    })

    await expect(googleTranslate("hello", "en", "zh")).rejects.toThrow("Unexpected response format")
  })
})
