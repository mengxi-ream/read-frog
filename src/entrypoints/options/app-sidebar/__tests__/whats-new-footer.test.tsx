// @vitest-environment jsdom
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WhatsNewFooter } from "../whats-new-footer"

const getLastViewedBlogDateMock = vi.fn()
const getLatestBlogDateMock = vi.fn()
const saveLastViewedBlogDateMock = vi.fn()

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/ui/base-ui/sidebar", () => ({
  SidebarMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/base-ui/popover", async () => {
  const React = await import("react")

  interface PopoverContextValue {
    open: boolean
    onOpenChange?: (open: boolean) => void
  }

  const PopoverContext = React.createContext<PopoverContextValue | null>(null)

  function usePopoverContext() {
    const context = React.use(PopoverContext)
    if (!context) {
      throw new Error("Popover components must be used within Popover.")
    }
    return context
  }

  function Popover({
    children,
    open = false,
    onOpenChange,
  }: {
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) {
    return (
      <PopoverContext value={{ open, onOpenChange }}>
        {children}
      </PopoverContext>
    )
  }

  function PopoverTrigger({
    children,
    render,
  }: {
    children: ReactNode
    render?: React.ReactElement<React.ComponentProps<"button">>
  }) {
    const { open, onOpenChange } = usePopoverContext()

    if (render && React.isValidElement(render)) {
      const originalOnClick = render.props.onClick

      // eslint-disable-next-line react/no-clone-element
      return React.cloneElement(render, {
        children,
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          originalOnClick?.(event)
          onOpenChange?.(!open)
        },
      })
    }

    return (
      <button type="button" onClick={() => onOpenChange?.(!open)}>
        {children}
      </button>
    )
  }

  function PopoverContent({ children }: { children: ReactNode }) {
    const { open } = usePopoverContext()
    return open ? <div data-testid="whats-new-popover-content">{children}</div> : null
  }

  return {
    Popover,
    PopoverContent,
    PopoverDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    PopoverHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    PopoverTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    PopoverTrigger,
  }
})

vi.mock("@/utils/blog", () => ({
  buildBilibiliEmbedUrl: vi.fn(() => null),
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
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return {
    promise,
    resolve,
  }
}

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

function renderWhatsNewFooter() {
  const queryClient = createQueryClient()

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <WhatsNewFooter />
      </QueryClientProvider>,
    ),
  }
}

const latestBlogPost = {
  date: new Date("2026-03-20T12:00:00.000Z"),
  description: "Latest updates",
  title: "Spring release",
  url: "/blog/spring-release",
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("whatsNewFooter", () => {
  it("auto-opens and marks the post as viewed when unread status arrives after the post", async () => {
    const latestBlogPostDeferred = createDeferred<typeof latestBlogPost | null>()
    const lastViewedDateDeferred = createDeferred<Date | null>()

    getLatestBlogDateMock.mockReturnValueOnce(latestBlogPostDeferred.promise)
    getLastViewedBlogDateMock
      .mockReturnValueOnce(lastViewedDateDeferred.promise)
      .mockResolvedValueOnce(latestBlogPost.date)
    saveLastViewedBlogDateMock.mockResolvedValue(undefined)

    renderWhatsNewFooter()

    await act(async () => {
      latestBlogPostDeferred.resolve(latestBlogPost)
    })

    await screen.findByRole("button", { name: "options.whatsNew.title" })
    expect(screen.queryByTestId("whats-new-popover-content")).not.toBeInTheDocument()
    expect(saveLastViewedBlogDateMock).not.toHaveBeenCalled()

    await act(async () => {
      lastViewedDateDeferred.resolve(null)
    })

    await screen.findByTestId("whats-new-popover-content")
    await waitFor(() => {
      expect(saveLastViewedBlogDateMock).toHaveBeenCalledTimes(1)
      expect(saveLastViewedBlogDateMock).toHaveBeenCalledWith(latestBlogPost.date)
    })
  })

  it("does not auto-open or mark the post as viewed when it is already read", async () => {
    getLatestBlogDateMock.mockResolvedValue(latestBlogPost)
    getLastViewedBlogDateMock.mockResolvedValue(
      new Date("2026-03-21T12:00:00.000Z"),
    )
    saveLastViewedBlogDateMock.mockResolvedValue(undefined)

    renderWhatsNewFooter()

    await screen.findByRole("button", { name: "options.whatsNew.title" })
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByTestId("whats-new-popover-content")).not.toBeInTheDocument()
    expect(saveLastViewedBlogDateMock).not.toHaveBeenCalled()
  })

  it("marks the post as viewed after a manual open once the unread query finishes", async () => {
    const lastViewedDateDeferred = createDeferred<Date | null>()

    getLatestBlogDateMock.mockResolvedValue(latestBlogPost)
    getLastViewedBlogDateMock
      .mockReturnValueOnce(lastViewedDateDeferred.promise)
      .mockResolvedValueOnce(latestBlogPost.date)
    saveLastViewedBlogDateMock.mockResolvedValue(undefined)

    renderWhatsNewFooter()

    const trigger = await screen.findByRole("button", { name: "options.whatsNew.title" })
    fireEvent.click(trigger)

    expect(await screen.findByTestId("whats-new-popover-content")).toBeInTheDocument()
    expect(saveLastViewedBlogDateMock).not.toHaveBeenCalled()

    await act(async () => {
      lastViewedDateDeferred.resolve(null)
    })

    await waitFor(() => {
      expect(saveLastViewedBlogDateMock).toHaveBeenCalledTimes(1)
      expect(saveLastViewedBlogDateMock).toHaveBeenCalledWith(latestBlogPost.date)
    })
  })
})
