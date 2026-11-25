// @vitest-environment jsdom
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useLatestBlogPost } from "../use-latest-blog-post"

const getBlogLocaleFromUILanguageMock = vi.fn<(...args: any[]) => any>(() => "zh")
const getLastViewedBlogDateMock = vi.fn<(...args: any[]) => any>()
const getLatestBlogDateMock = vi.fn<(...args: any[]) => any>()
const saveLastViewedBlogDateMock = vi.fn<(...args: any[]) => any>()

vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtomValue: () => "zh-CN",
}))

vi.mock("@/utils/blog", async () => {
  return {
    getBlogLocaleFromUILanguage: (...args: unknown[]) => getBlogLocaleFromUILanguageMock(...args),
    getLastViewedBlogDate: (...args: unknown[]) => getLastViewedBlogDateMock(...args),
    getLatestBlogDate: (...args: unknown[]) => getLatestBlogDateMock(...args),
    hasNewBlogPost: (latestViewedDate: Date | null, latestDate: Date | null) => {
      if (!latestDate) {
        return false
      }

      if (!latestViewedDate) {
        return true
      }

      return latestDate > latestViewedDate
    },
    saveLastViewedBlogDate: (...args: unknown[]) => saveLastViewedBlogDateMock(...args),
  }
})

function renderLatestBlogPost() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  })

  return renderHook(() => useLatestBlogPost(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("useLatestBlogPost", () => {
  it("requests the latest blog post using the resolved blog locale", async () => {
    getLastViewedBlogDateMock.mockResolvedValue(null)
    getLatestBlogDateMock.mockResolvedValue(null)

    const { result } = renderLatestBlogPost()

    await waitFor(() => {
      expect(getBlogLocaleFromUILanguageMock).toHaveBeenCalledWith("zh-CN")
      expect(getLatestBlogDateMock).toHaveBeenCalledWith(
        "https://www.readfrog.app/api/blog/latest",
        "zh",
        expect.stringMatching(/^\d+\.\d+\.\d+$/),
      )
    })
    expect(result.current.hasNewPost).toBe(false)
  })

  it("reports a post the user has not opened, and marks it read when opened", async () => {
    const date = new Date("2026-11-20T00:00:00Z")
    getLastViewedBlogDateMock.mockResolvedValue(new Date("2026-11-01T00:00:00Z"))
    getLatestBlogDateMock.mockResolvedValue({ date, url: "/blog/simple-mode" })
    saveLastViewedBlogDateMock.mockResolvedValue(undefined)
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null)

    const { result } = renderLatestBlogPost()
    await waitFor(() => expect(result.current.hasNewPost).toBe(true))

    getLastViewedBlogDateMock.mockResolvedValue(date)
    await act(() => result.current.open())

    expect(saveLastViewedBlogDateMock).toHaveBeenCalledWith(date)
    expect(openSpy).toHaveBeenCalledWith(
      "https://www.readfrog.app/blog/simple-mode",
      "_blank",
      "noopener,noreferrer",
    )
    await waitFor(() => expect(result.current.hasNewPost).toBe(false))
  })
})
