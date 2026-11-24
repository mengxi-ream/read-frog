// @vitest-environment jsdom
import type { VideoTranscriptUsage, VideoTranscriptUsagePool } from "@read-frog/api-contract"
import { ORPCError } from "@orpc/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AiSubtitlesUsage } from "@/entrypoints/options/pages/usage/ai-subtitles-usage"

const state = vi.hoisted(() => ({
  signedIn: true,
  sessionListeners: new Set<() => void>(),
  getUsage: vi.fn<() => Promise<VideoTranscriptUsage>>(),
  refetchSession: vi.fn<() => Promise<void>>(),
  sendMessage: vi.fn<(type: string) => Promise<void>>(),
}))

/** Changes the session the way better-auth's store does: every reader re-renders. */
function setSignedIn(signedIn: boolean) {
  state.signedIn = signedIn
  for (const listener of state.sessionListeners) listener()
}

vi.mock("@/utils/auth/auth-client", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    authClient: {
      useSession: () => {
        const signedIn = useSyncExternalStore(
          (listener) => {
            state.sessionListeners.add(listener)
            return () => state.sessionListeners.delete(listener)
          },
          () => state.signedIn,
        )
        return {
          data: signedIn ? { user: { id: "user-1" } } : null,
          isPending: false,
          refetch: state.refetchSession,
        }
      },
    },
  }
})

vi.mock("@/utils/message", () => ({
  sendMessage: (type: string) => state.sendMessage(type),
}))

vi.mock("@/utils/orpc/client", () => ({
  orpc: {
    videoTranscript: {
      getUsage: {
        queryOptions: (options: Record<string, unknown>) => ({
          queryKey: ["videoTranscript", "getUsage"],
          queryFn: () => state.getUsage(),
          ...options,
        }),
      },
    },
  },
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values?.length ? `${key}:${values.join(",")}` : key,
  },
}))

function renderUsage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AiSubtitlesUsage />
    </QueryClientProvider>,
  )
}

const PAID_USAGE: VideoTranscriptUsage = {
  plan: "pro",
  usedMinutes: 25,
  limitMinutes: 1300,
  remainingMinutes: 1275,
  pools: [
    {
      id: "subscription",
      usedMinutes: 25,
      limitMinutes: 1000,
      remainingMinutes: 975,
      resetAt: "2026-12-01T00:00:00.000Z",
      expiresAt: null,
    },
    {
      id: "launchBonus",
      usedMinutes: 0,
      limitMinutes: 300,
      remainingMinutes: 300,
      resetAt: null,
      expiresAt: "2027-08-13T00:00:00.000Z",
    },
  ],
}

describe("AiSubtitlesUsage", () => {
  beforeEach(() => {
    state.signedIn = true
    state.getUsage.mockReset()
    state.refetchSession.mockReset().mockResolvedValue(undefined)
    state.sendMessage.mockReset().mockResolvedValue(undefined)
  })

  it("asks a guest to log in without requesting usage", () => {
    state.signedIn = false

    renderUsage()

    expect(screen.getByText("options.usage.logInToView")).toBeInTheDocument()
    expect(state.getUsage).not.toHaveBeenCalled()
  })

  it("renders one bar per pool, filled with what is left", async () => {
    state.getUsage.mockResolvedValue(PAID_USAGE)

    renderUsage()

    const bars = await screen.findAllByRole("progressbar")
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveAttribute("aria-valuenow", "97.5")
    expect(bars[1]).toHaveAttribute("aria-valuenow", "100")
    expect(
      screen.getByText("options.videoSubtitles.aiQuota.remainingOf:975,1000"),
    ).toBeInTheDocument()
    expect(screen.getByText("options.videoSubtitles.aiQuota.pools.launchBonus")).toBeInTheDocument()
  })

  it("turns a pool's bar red once 90% of it is gone", async () => {
    const [subscription, launchBonus] = PAID_USAGE.pools as [
      VideoTranscriptUsagePool,
      VideoTranscriptUsagePool,
    ]
    state.getUsage.mockResolvedValue({
      ...PAID_USAGE,
      pools: [{ ...subscription, usedMinutes: 950, remainingMinutes: 50 }, launchBonus],
    })

    renderUsage()

    const bars = await screen.findAllByRole("progressbar")
    expect(bars[0]?.className).toContain("bg-destructive")
    expect(bars[1]?.className).not.toContain("bg-destructive")
  })

  it("says a free account needs a subscription", async () => {
    state.getUsage.mockResolvedValue({ ...PAID_USAGE, plan: "free", pools: [] })

    renderUsage()

    expect(
      await screen.findByText("options.videoSubtitles.aiQuota.upgradeRequired"),
    ).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("reads the beta 403 as needing a subscription", async () => {
    state.getUsage.mockRejectedValue(new ORPCError("FORBIDDEN"))

    renderUsage()

    expect(
      await screen.findByText("options.videoSubtitles.aiQuota.upgradeRequired"),
    ).toBeInTheDocument()
  })

  it("rechecks a session the server has ended, so the card turns logged out", async () => {
    state.getUsage.mockRejectedValue(new ORPCError("UNAUTHORIZED"))
    const order: string[] = []
    state.sendMessage.mockImplementation(async (type) => {
      order.push(type)
    })
    state.refetchSession.mockImplementation(async () => {
      order.push("refetchSession")
      setSignedIn(false)
    })

    renderUsage()

    expect(await screen.findByText("options.usage.logInToView")).toBeInTheDocument()
    await waitFor(() => expect(state.signedIn).toBe(false))
    // The cache goes first, or the refetch would read the stale session back.
    expect(order).toEqual(["invalidateAuthCache", "refetchSession"])
    expect(state.getUsage).toHaveBeenCalledTimes(1)
  })

  it("rechecks only once when the server still reports the session", async () => {
    state.getUsage.mockRejectedValue(new ORPCError("UNAUTHORIZED"))
    // Reloading, the session reads as signed out for a moment, then signed in again.
    state.refetchSession.mockImplementation(async () => {
      setSignedIn(false)
      await new Promise((resolve) => setTimeout(resolve, 10))
      setSignedIn(true)
    })

    renderUsage()

    await waitFor(() => expect(state.refetchSession).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(state.getUsage).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("options.usage.logInToView")).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(state.sendMessage).toHaveBeenCalledTimes(1)
    expect(state.refetchSession).toHaveBeenCalledTimes(1)
  })

  it("does not recheck the session for any other failure", async () => {
    state.getUsage.mockRejectedValue(new ORPCError("FORBIDDEN"))

    renderUsage()

    expect(
      await screen.findByText("options.videoSubtitles.aiQuota.upgradeRequired"),
    ).toBeInTheDocument()
    expect(state.sendMessage).not.toHaveBeenCalled()
    expect(state.refetchSession).not.toHaveBeenCalled()
  })

  it("holds a loading row shaped like a loaded one", () => {
    state.getUsage.mockReturnValue(new Promise(() => {}))

    renderUsage()

    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(5)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("says the quota could not load on any other failure", async () => {
    state.getUsage.mockRejectedValue(new Error("network down"))

    renderUsage()

    expect(await screen.findByText("options.videoSubtitles.aiQuota.loadError")).toBeInTheDocument()
  })
})
