// @vitest-environment jsdom
import type { VideoTranscriptUsage } from "@read-frog/api-contract"
import { ORPCError } from "@orpc/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AiSubtitlesUsage } from "@/entrypoints/options/pages/usage/ai-subtitles-usage"

const state = vi.hoisted(() => ({
  signedIn: true,
  getUsage: vi.fn<() => Promise<VideoTranscriptUsage>>(),
}))

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: state.signedIn ? { user: { id: "user-1" } } : null,
      isPending: false,
    }),
  },
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

  it("reads an expired session as signed out", async () => {
    state.getUsage.mockRejectedValue(new ORPCError("UNAUTHORIZED"))

    renderUsage()

    expect(await screen.findByText("options.usage.logInToView")).toBeInTheDocument()
  })

  it("says the quota could not load on any other failure", async () => {
    state.getUsage.mockRejectedValue(new Error("network down"))

    renderUsage()

    expect(await screen.findByText("options.videoSubtitles.aiQuota.loadError")).toBeInTheDocument()
  })
})
