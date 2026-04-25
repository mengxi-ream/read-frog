// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockDefuddleConstructor, mockParse, mockWarn } = vi.hoisted(() => ({
  mockDefuddleConstructor: vi.fn(),
  mockParse: vi.fn(),
  mockWarn: vi.fn(),
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mockWarn,
  },
}))

async function loadModule() {
  vi.resetModules()
  vi.doMock("defuddle", () => ({
    __esModule: true,
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
    mockParse.mockReset()
    mockWarn.mockReset()

    mockParse.mockReturnValue({ contentMarkdown: "# Readable page body" })

    document.title = "Original Title"
    document.body.innerHTML = "<main>Page body</main>"
    window.history.replaceState({}, "", "/article")
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
      webContent: first?.webContent,
    })
    expect(mockDefuddleConstructor).toHaveBeenCalledTimes(1)
  })

  it("parses webpage content as markdown with Defuddle", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toBe("# Readable page body")
    expect(mockDefuddleConstructor).toHaveBeenCalledWith(document, {
      markdown: true,
      url: window.location.href,
      useAsync: false,
    })
  })

  it("refreshes the cached title and content after the URL changes", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const first = await getOrCreateWebPageContext()

    document.title = "Next Article Title"
    document.body.innerHTML = "<main>Next article body</main>"
    mockParse.mockReturnValueOnce({ contentMarkdown: "## Next readable page body" })
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
    mockParse.mockReturnValueOnce({ contentMarkdown: longContent })

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
