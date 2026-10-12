// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockCreateMarkdownContent, mockDefuddleConstructor, mockParse, mockWarn } = vi.hoisted(
  () => ({
    mockCreateMarkdownContent: vi.fn<(...args: any[]) => any>(),
    mockDefuddleConstructor: vi.fn<(...args: any[]) => any>(),
    mockParse: vi.fn<(...args: any[]) => any>(),
    mockWarn: vi.fn<(...args: any[]) => any>(),
  }),
)

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mockWarn,
  },
}))

async function loadModule() {
  vi.resetModules()
  vi.doMock("defuddle/full", () => ({
    __esModule: true,
    createMarkdownContent: mockCreateMarkdownContent,
    default: class MockDefuddle {
      constructor(...args: unknown[]) {
        mockDefuddleConstructor(...args)
      }

      parse() {
        return mockParse()
      }
    },
  }))
  return await import("../webpage-context")
}

describe("getOrCreateWebPageContext", () => {
  beforeEach(() => {
    mockDefuddleConstructor.mockReset()
    mockCreateMarkdownContent.mockReset()
    mockParse.mockReset()
    mockWarn.mockReset()

    mockParse.mockReturnValue({ content: "<h1>Readable page body</h1>" })
    mockCreateMarkdownContent.mockReturnValue("# Readable page body")

    document.head.innerHTML = ""
    document.title = "Original Title"
    document.body.innerHTML = "<main>Page body</main>"
    window.history.replaceState({}, "", "/article")
    delete window.__READ_FROG_TRANSLATED_DOCUMENT_TITLE__
  })

  it("keeps the original title stable on the same URL", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const first = await getOrCreateWebPageContext()

    document.title = "Translated Browser Title"
    const second = await getOrCreateWebPageContext()

    expect(first?.webTitle).toBe("Original Title")
    expect(first?.webContent).toBe("# Readable page body")
    expect(second).toEqual({
      url: first?.url,
      webTitle: "Original Title",
      webDescription: "",
      webContent: first?.webContent,
    })
    expect(mockDefuddleConstructor).toHaveBeenCalledTimes(1)
  })

  it("extracts webpage content with Defuddle and converts it to markdown", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toBe("# Readable page body")
    expect(mockDefuddleConstructor).toHaveBeenCalledWith(document, {
      url: window.location.href,
      useAsync: false,
    })
    expect(mockCreateMarkdownContent).toHaveBeenCalledWith(
      "<h1>Readable page body</h1>",
      window.location.href,
    )
  })

  it("converts only the leading content that fits the context limit", async () => {
    const leading = `<p>${"a".repeat(1500)}</p><p>${"b".repeat(1500)}</p>`
    const cladogram =
      '<table class="clade"><tr><td>'.repeat(20) + "Anura" + "</td></tr></table>".repeat(20)
    mockParse.mockReturnValueOnce({
      content: `<article>${leading}<h2>Phylogeny</h2>${cladogram}</article>`,
    })
    const { getOrCreateWebPageContext } = await loadModule()

    await getOrCreateWebPageContext()

    expect(mockCreateMarkdownContent).toHaveBeenCalledWith(
      `<article>${leading}</article>`,
      window.location.href,
    )
  })

  it("flattens tables nested inside other tables before converting to markdown", async () => {
    const cladogram =
      '<table class="clade"><tr><td>'.repeat(20) + "Anura" + "</td></tr></table>".repeat(20)
    mockParse.mockReturnValueOnce({ content: `<article><p>Frogs</p>${cladogram}</article>` })
    const { getOrCreateWebPageContext } = await loadModule()

    await getOrCreateWebPageContext()

    const markdownSource = String(mockCreateMarkdownContent.mock.lastCall?.[0])
    expect(markdownSource.match(/<table/g)).toHaveLength(1)
    expect(markdownSource).toContain("Anura")
  })

  it("reads webpage description from meta tags", async () => {
    document.head.innerHTML = `<meta name="description" content="  Article   description  ">`
    const { getOrCreateWebPageContext } = await loadModule()

    const result = await getOrCreateWebPageContext()

    expect(result?.webDescription).toBe("Article description")
  })

  it("uses the page's own title for a context built while the tab shows its translation", async () => {
    const { getOrCreateWebPageContext } = await loadModule()
    const { setAppliedDocumentTitleTranslation } = await import("@/utils/content/document-title")

    await getOrCreateWebPageContext()

    // Page translation swapped the tab title, then an SPA navigation changed
    // the URL before the router set the next title, which rebuilds the context.
    setAppliedDocumentTitleTranslation("Original Title", "Translated Browser Title")
    document.title = "Translated Browser Title"
    window.history.replaceState({}, "", "/article-2")

    const rebuilt = await getOrCreateWebPageContext()

    expect(mockDefuddleConstructor).toHaveBeenCalledTimes(2)
    expect(rebuilt?.webTitle).toBe("Original Title")
  })

  it("keeps the context across an in-page anchor jump", async () => {
    document.body.innerHTML = `<main>Page body</main><h2 id="far">Far section</h2>`
    const { getOrCreateWebPageContext } = await loadModule()

    const first = await getOrCreateWebPageContext()

    // By now the page holds its translations; re-reading it would change the content.
    document.body.innerHTML += "<p>Translated paragraph</p>"
    mockCreateMarkdownContent.mockReturnValueOnce("# Page body with translations")
    window.history.replaceState({}, "", "/article#far")

    const second = await getOrCreateWebPageContext()

    expect(mockDefuddleConstructor).toHaveBeenCalledTimes(1)
    expect(second).toEqual({ ...first, url: window.location.href })
  })

  it("matches a percent-encoded anchor to its element", async () => {
    document.body.innerHTML = `<main>Page body</main><h2 id="历史">History</h2>`
    const { getOrCreateWebPageContext } = await loadModule()

    await getOrCreateWebPageContext()
    window.history.replaceState({}, "", "/article#历史")

    expect(window.location.href).toContain("#%E5%8E%86%E5%8F%B2")
    await getOrCreateWebPageContext()
    expect(mockDefuddleConstructor).toHaveBeenCalledTimes(1)
  })

  it("rebuilds the context when a hash route changes", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    await getOrCreateWebPageContext()
    window.history.replaceState({}, "", "/article#/settings")
    await getOrCreateWebPageContext()

    // Leaving the route for the bare URL is a route change too.
    window.history.replaceState({}, "", "/article")
    await getOrCreateWebPageContext()

    expect(mockDefuddleConstructor).toHaveBeenCalledTimes(3)
  })

  it("refreshes the cached title and content after the URL changes", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const first = await getOrCreateWebPageContext()

    document.title = "Next Article Title"
    document.body.innerHTML = "<main>Next article body</main>"
    mockCreateMarkdownContent.mockReturnValueOnce("## Next readable page body")
    window.history.replaceState({}, "", "/article-2")

    const second = await getOrCreateWebPageContext()

    expect(first?.webTitle).toBe("Original Title")
    expect(second?.webTitle).toBe("Next Article Title")
    expect(second?.webContent).toBeTruthy()
    expect(second?.webContent).not.toBe(first?.webContent)
  })

  it("truncates webpage content to the shared limit when caching a new URL", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const longContent = "x".repeat(2100)
    document.body.innerHTML = `<main>${longContent}</main>`
    mockCreateMarkdownContent.mockReturnValueOnce(longContent)

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toHaveLength(2000)
    expect(result?.webContent).toBe(longContent.slice(0, 2000))
  })

  it("falls back to body text when Defuddle parsing fails", async () => {
    mockParse.mockImplementationOnce(() => {
      throw new Error("parse failed")
    })
    document.body.innerHTML = "<main>Fallback body text</main>"
    const { getOrCreateWebPageContext } = await loadModule()

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toBe("Fallback body text")
    expect(mockWarn).toHaveBeenCalledWith(
      "Defuddle parsing failed, falling back to body text:",
      expect.any(Error),
    )
  })
})
