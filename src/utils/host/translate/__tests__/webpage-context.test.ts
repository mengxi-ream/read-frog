// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockParse = vi.fn()
const mockRemoveDummyNodes = vi.fn()
const mockWarn = vi.fn()

vi.mock("@mozilla/readability", () => ({
  Readability: vi.fn().mockImplementation(() => ({
    parse: mockParse,
  })),
}))

vi.mock("@/utils/content/utils", () => ({
  removeDummyNodes: mockRemoveDummyNodes,
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mockWarn,
  },
}))

async function loadModule() {
  vi.resetModules()
  return await import("../webpage-context")
}

describe("getOrCreateWebPageContext", () => {
  beforeEach(() => {
    mockParse.mockReset()
    mockRemoveDummyNodes.mockReset()
    mockWarn.mockReset()

    mockParse.mockReturnValue({ textContent: "Readable page body" })
    mockRemoveDummyNodes.mockResolvedValue(undefined)

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
    expect(first?.webContent).toBeTruthy()
    expect(second).toEqual({
      url: first?.url,
      webTitle: "Original Title",
      webContent: first?.webContent,
    })
  })

  it("refreshes the cached title and content after the URL changes", async () => {
    const { getOrCreateWebPageContext } = await loadModule()

    const first = await getOrCreateWebPageContext()

    document.title = "Next Article Title"
    document.body.innerHTML = "<main>Next article body</main>"
    mockParse.mockReturnValueOnce({ textContent: "Next readable page body" })
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
    mockParse.mockReturnValueOnce({ textContent: longContent })

    const result = await getOrCreateWebPageContext()

    expect(result?.webContent).toHaveLength(2000)
    expect(result?.webContent).toBe(longContent.slice(0, 2000))
  })
})
