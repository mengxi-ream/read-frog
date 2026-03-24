// @vitest-environment jsdom
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import BlogNotification from "../blog-notification"

const getLastViewedBlogDateMock = vi.fn()
const getLatestBlogDateMock = vi.fn()
const saveLastViewedBlogDateMock = vi.fn()

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/ui/base-ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/base-ui/tooltip", async () => {
  function Tooltip({ children }: { children: ReactNode }) {
    return <div>{children}</div>
  }

  function TooltipTrigger({
    render,
  }: {
    render?: React.ReactElement<React.ComponentProps<"button">>
  }) {
    return render ?? null
  }

  function TooltipContent({ children }: { children: ReactNode }) {
    return <div>{children}</div>
  }

  return {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
  }
})

vi.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}))

vi.mock("@/utils/blog", async () => {
  return {
    getBlogLocaleFromUILanguage: vi.fn(() => "zh"),
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  })
}

function renderBlogNotification() {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <BlogNotification />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("blogNotification", () => {
  it("requests the latest blog post using the resolved blog locale", async () => {
    getLastViewedBlogDateMock.mockResolvedValue(null)
    getLatestBlogDateMock.mockResolvedValue(null)

    renderBlogNotification()

    await waitFor(() => {
      expect(getLatestBlogDateMock).toHaveBeenCalledWith(
        "https://www.readfrog.app/api/blog/latest",
        "zh",
        "1.31.3",
      )
    })
  })
})
