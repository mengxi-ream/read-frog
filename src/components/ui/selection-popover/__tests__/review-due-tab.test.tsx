// @vitest-environment jsdom
import type { ReviewEntrySource } from "@read-frog/definitions"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { env } from "@/env"
import { sendMessage } from "@/utils/message"
import { ReviewDueTab } from "../review-due-tab"

const mockAuthState = vi.hoisted(() => ({
  session: { user: { id: "user-1" } } as { user: { id: string } } | null,
  isPending: false,
}))

// What `notebase.list` and `srs.scheduleStatusStats` return.
const listMock = vi.hoisted(() => vi.fn<() => unknown>())
const statsMock = vi.hoisted(() => vi.fn<(input: { timezone: string }) => unknown>())
// Records what the tab hands oRPC for each procedure, so the tests can check
// the queries it runs.
const queryOptionsMock = vi.hoisted(() => vi.fn<(procedure: string, options: any) => void>())

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: mockAuthState.session, isPending: mockAuthState.isPending }),
  },
}))

// The global stub echoes keys and drops the count; the tab splits the text
// around its count, so these two keys get their English text.
vi.mock("@/utils/i18n", () => {
  const messages: Record<string, string> = {
    "action.reviewDueOne": "$1 card to review",
    "action.reviewDueOther": "$1 cards to review",
  }
  return {
    i18n: {
      t: (key: string, [count]: [string] = [""]) => (messages[key] ?? key).replace("$1", count),
    },
  }
})

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/orpc/client", () => {
  function procedure(path: [string, string], fetch: (input: any) => unknown) {
    return {
      queryKey: ({ input }: { input: unknown }) => [path, { type: "query", input }],
      queryOptions: (options: any) => {
        queryOptionsMock(path.join("."), options)
        return { ...options, queryFn: async () => fetch(options.input) }
      },
    }
  }
  return {
    orpc: {
      notebase: { list: procedure(["notebase", "list"], () => listMock()) },
      srs: {
        scheduleStatusStats: procedure(["srs", "scheduleStatusStats"], (input) => statsMock(input)),
      },
    },
  }
})

const timezone = new Intl.DateTimeFormat().resolvedOptions().timeZone

// Two awake notebases and one asleep, whose cards the count leaves out.
const notebases = [
  { id: "words", name: "Words", srsSleepingAt: null },
  { id: "reading", name: "Reading", srsSleepingAt: null },
  { id: "japanese", name: "Japanese", srsSleepingAt: new Date("2026-11-10T08:00:00Z") },
]
const sleepingStats = { new: 5, learning: 3, review: 9 }

function renderTab(source: ReviewEntrySource = "extension_selection_translation") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewDueTab source={source} />
    </QueryClientProvider>,
  )
}

function lastQueryOptions(procedure: "notebase.list" | "srs.scheduleStatusStats") {
  return queryOptionsMock.mock.calls.findLast(([name]) => name === procedure)?.[1]
}

// One more turn, so the resolved queries have rendered.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("reviewDueTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.session = { user: { id: "user-1" } }
    mockAuthState.isPending = false
    listMock.mockResolvedValue(notebases)
    statsMock.mockResolvedValue({
      words: { new: 2, learning: 1, review: 0 },
      reading: { new: 0, learning: 0, review: 4 },
      japanese: sleepingStats,
    })
  })

  it("adds up today's cards over the awake notebases, per user", async () => {
    renderTab()

    expect(await screen.findByRole("button", { name: "7 cards to review" })).toBeInTheDocument()
    expect(statsMock).toHaveBeenCalledWith({ timezone })
    const rules = { enabled: true, retry: false, staleTime: 60_000, meta: { suppressToast: true } }
    expect(lastQueryOptions("notebase.list")).toMatchObject({
      input: {},
      queryKey: [["notebase", "list"], { type: "query", input: {} }, "user-1"],
      ...rules,
    })
    expect(lastQueryOptions("srs.scheduleStatusStats")).toMatchObject({
      input: { timezone },
      queryKey: [["srs", "scheduleStatusStats"], { type: "query", input: { timezone } }, "user-1"],
      ...rules,
    })
  })

  it("uses the singular text for one card", async () => {
    statsMock.mockResolvedValue({
      words: { new: 0, learning: 1, review: 0 },
      reading: { new: 0, learning: 0, review: 0 },
      japanese: sleepingStats,
    })
    renderTab()

    expect(await screen.findByRole("button", { name: "1 card to review" })).toBeInTheDocument()
  })

  it("stays hidden when only sleeping notebases have cards due", async () => {
    statsMock.mockResolvedValue({
      words: { new: 0, learning: 0, review: 0 },
      reading: { new: 0, learning: 0, review: 0 },
      japanese: sleepingStats,
    })
    const { container } = renderTab()

    await waitFor(() => expect(statsMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it("stays hidden, and asks nothing, for a guest", async () => {
    mockAuthState.session = null
    const { container } = renderTab()

    await settle()
    expect(container).toBeEmptyDOMElement()
    for (const procedure of ["notebase.list", "srs.scheduleStatusStats"] as const) {
      expect(lastQueryOptions(procedure)).toMatchObject({ enabled: false })
      expect(lastQueryOptions(procedure).queryKey.at(-1)).toBe("guest")
    }
    expect(listMock).not.toHaveBeenCalled()
    expect(statsMock).not.toHaveBeenCalled()
  })

  it("waits for the session before asking", async () => {
    mockAuthState.isPending = true
    mockAuthState.session = null
    const { container } = renderTab()

    await settle()
    expect(container).toBeEmptyDOMElement()
    expect(listMock).not.toHaveBeenCalled()
    expect(statsMock).not.toHaveBeenCalled()
  })

  it.each([
    ["the notebases", listMock],
    ["the counts", statsMock],
  ])("stays hidden when %s fail to load", async (_, failingMock) => {
    failingMock.mockRejectedValue(new Error("network down"))
    const { container } = renderTab()

    await waitFor(() => expect(failingMock).toHaveBeenCalledTimes(1))
    await settle()
    expect(container).toBeEmptyDOMElement()
  })

  it.each<ReviewEntrySource>(["extension_selection_translation", "extension_custom_ai_action"])(
    "opens the combined review with the %s source",
    async (source) => {
      renderTab(source)

      fireEvent.click(await screen.findByRole("button", { name: "7 cards to review" }))

      const reviewUrl = new URL(`/review?source=${source}`, env.WXT_WEBSITE_URL).toString()
      expect(sendMessage).toHaveBeenCalledExactlyOnceWith("openPage", {
        url: reviewUrl,
        active: true,
      })
    },
  )
})
