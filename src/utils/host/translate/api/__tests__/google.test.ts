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

  describe("punctuation runs", () => {
    const run = (index: number) => `<span data-read-frog-run="${index}"></span>`
    const banner = `---[INTRODUCTION]${"-".repeat(61)}`

    it("sends each run as an empty placeholder and puts the source run back", async () => {
      // Live: sent as-is this banner comes back "- -[介绍] -  -  - …".
      mockTranslateResponse(`${run(0)}[介绍]${run(1)}`)

      const result = await googleTranslate(banner, "auto", "zh-CN")

      expect(sentSourceText()).toBe(`${run(0)}[INTRODUCTION]${run(1)}`)
      expect(result).toBe(`---[介绍]${"-".repeat(61)}`)
    })

    it("restores the source spacing around a run, not the model's", async () => {
      mockTranslateResponse(`${run(0)}第二章${run(1)}`)

      const result = await googleTranslate("~~~~ Chapter 2 ~~~~", "en", "zh-CN")

      expect(sentSourceText()).toBe(`${run(0)} Chapter 2 ${run(1)}`)
      expect(result).toBe("~~~~ 第二章 ~~~~")
    })

    it("drops whitespace the model adds next to a placeholder", async () => {
      mockTranslateResponse(`+${run(0)} +${run(1)} +`)

      const result = await googleTranslate("+-----+=====+", "en", "zh-CN")

      expect(sentSourceText()).toBe(`+${run(0)}+${run(1)}+`)
      expect(result).toBe("+-----+=====+")
    })

    it.each([
      ["equals rules", "=====", run(0)],
      ["underscore blanks", "Name: ______", `Name: ${run(0)}`],
      ["asterisk banners", "*** Boss ***", `${run(0)} Boss ${run(1)}`],
      ["hash banners", "### Weapons ###", `${run(0)} Weapons ${run(1)}`],
      ["dot leaders", "Controls ...... [CTRL]", `Controls ${run(0)} [CTRL]`],
    ])("protects %s", async (_name, source, sent) => {
      mockTranslateResponse("ok")

      await googleTranslate(source, "en", "zh-CN")

      expect(sentSourceText()).toBe(sent)
    })

    it("leaves short runs and ellipses alone", async () => {
      mockTranslateResponse("ok")

      await googleTranslate("a -- b... c == d __init", "en", "zh-CN")

      expect(sentSourceText()).toBe("a -- b... c == d __init")
    })

    it("protects runs in html text content but not in attribute values", async () => {
      const source = '<b data-rf-attr="0" title="a---b">---[CONTROLS]---</b>'
      mockTranslateResponse(`<b data-rf-attr="0" title="a---b">${run(0)}[操作]${run(1)}</b>`)

      const result = await googleTranslate(source, "en", "zh-CN", { textFormat: "html" })

      expect(sentSourceText()).toBe(
        `<b data-rf-attr="0" title="a---b">${run(0)}[CONTROLS]${run(1)}</b>`,
      )
      expect(result).toBe('<b data-rf-attr="0" title="a---b">---[操作]---</b>')
    })

    it("keeps a banner line's dashes with preserveLineBreaks", async () => {
      // Restoring before line reassembly must not let the prefix
      // normalization eat the banner's leading dashes.
      const lineBreakPair = '<br data-read-frog-lb="1">'.repeat(2)
      mockTranslateResponse(`${run(0)}[介绍]${run(1)}${lineBreakPair}欢迎`)

      const result = await googleTranslate(`${banner}\nWelcome`, "auto", "zh-CN", {
        preserveLineBreaks: true,
      })

      expect(sentSourceText()).toBe(`${run(0)}[INTRODUCTION]${run(1)}${lineBreakPair}Welcome`)
      expect(result).toBe(`---[介绍]${"-".repeat(61)}\n欢迎`)
    })

    it("keeps a banner line's dashes in html with preserveLineBreaks", async () => {
      // translationOnly on a plain-text page: each banner line is its own
      // marker-delimited segment, which is what exposes the mangling.
      const lineBreakPair = '<br data-read-frog-lb="1">'.repeat(2)
      mockTranslateResponse(`${run(0)}[介绍]${run(1)}${lineBreakPair}<b>欢迎</b>`)

      const result = await googleTranslate(`${banner}\n<b>Welcome</b>`, "auto", "zh-CN", {
        textFormat: "html",
        preserveLineBreaks: true,
      })

      expect(sentSourceText()).toBe(
        `${run(0)}[INTRODUCTION]${run(1)}${lineBreakPair}<b>Welcome</b>`,
      )
      expect(result).toBe(`---[介绍]${"-".repeat(61)}\n<b>欢迎</b>`)
    })

    it("accepts self-closing placeholders and drops indexes it never sent", async () => {
      mockTranslateResponse(
        `<span data-read-frog-run="0"/>[介绍]<span data-read-frog-run="9"></span>介绍`,
      )

      const result = await googleTranslate("---[INTRODUCTION]", "en", "zh-CN")

      expect(result).toBe("---[介绍] 介绍")
    })
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
