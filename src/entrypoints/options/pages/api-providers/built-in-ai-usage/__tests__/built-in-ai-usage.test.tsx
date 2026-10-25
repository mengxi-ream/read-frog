// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { HostedAiStatusResult } from "@/components/llm-providers/use-hosted-ai-status"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BuiltInAiUsageConfig } from "@/entrypoints/options/pages/api-providers/built-in-ai-usage"
import { formatHostedAiResetAtLocal } from "@/utils/hosted-ai/status"

const { hostedAiState } = vi.hoisted(() => {
  const state: { value: HostedAiStatusResult } = {
    value: { status: undefined, isSignedIn: true, isPending: true, isError: false },
  }
  return { hostedAiState: state }
})

vi.mock("@/components/llm-providers/use-hosted-ai-status", () => ({
  useHostedAiStatus: () => hostedAiState.value,
}))

// Inline the hover-only tooltip content so the feature list is assertable.
vi.mock("@/components/ui/base-ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values?.length ? `${key}:${values.join(",")}` : key,
  },
}))

describe("BuiltInAiUsageConfig", () => {
  beforeEach(() => {
    hostedAiState.value = { status: undefined, isSignedIn: true, isPending: true, isError: false }
  })

  it("renders one bar per credit pool whose fill is the remaining share", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [
          {
            periodKind: "weekly",
            usedPercent: 37.6,
            resetAt: "2026-08-16T03:36:00.000Z",
            features: ["pageTranslation", "customAction", "noteSuggestion"],
          },
        ],
        features: {} as never,
      },
    }

    render(<BuiltInAiUsageConfig />)

    // The track is the full quota; the indicator holds what is left (100 - 37.6 → 62).
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62")
    expect(screen.getByText("options.apiProviders.builtInAiUsage.remaining:62")).toBeInTheDocument()
    // The label counts features; the names live in the hover list.
    expect(
      screen.getByText("options.apiProviders.builtInAiUsage.supportedFeatures:3"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("options.apiProviders.builtInAiUsage.features.pageTranslation"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("options.apiProviders.builtInAiUsage.features.customAction"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("options.apiProviders.builtInAiUsage.features.noteSuggestion"),
    ).toBeInTheDocument()
    expect(screen.getByText("options.apiProviders.builtInAiUsage.weekly")).toBeInTheDocument()
    // Rendered in the viewer's own timezone, not UTC.
    const expectedLocalResetAt = formatHostedAiResetAtLocal("2026-08-16T03:36:00.000Z")
    expect(
      screen.getByText(`options.apiProviders.builtInAiUsage.resetsAt:${expectedLocalResetAt}`),
    ).toBeInTheDocument()
  })

  it("clamps an overspent pool to an empty bar instead of a negative one", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [
          {
            periodKind: "daily",
            usedPercent: 120,
            resetAt: null,
            features: ["customAction"],
          },
        ],
        features: {} as never,
      },
    }

    render(<BuiltInAiUsageConfig />)

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
    expect(screen.getByText("options.apiProviders.builtInAiUsage.remaining:0")).toBeInTheDocument()
  })

  it("falls back to the unavailability line when the status request fails", () => {
    hostedAiState.value = { status: undefined, isSignedIn: true, isPending: false, isError: true }

    render(<BuiltInAiUsageConfig />)

    expect(screen.getByText("hostedAi.availability.serviceUnavailable")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("shows a skeleton while the status is loading", () => {
    render(<BuiltInAiUsageConfig />)

    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("renders nothing at all for guests", () => {
    hostedAiState.value = {
      isSignedIn: false,
      isPending: false,
      isError: false,
      status: {
        credits: [
          { periodKind: "daily", usedPercent: 0, resetAt: null, features: ["customAction"] },
        ],
        features: {} as never,
      },
    }

    const { container } = render(<BuiltInAiUsageConfig />)

    expect(container).toBeEmptyDOMElement()
  })

  it("treats an empty credits list like an unavailable status", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: { credits: [], features: {} as never },
    }

    render(<BuiltInAiUsageConfig />)

    expect(screen.getByText("hostedAi.availability.serviceUnavailable")).toBeInTheDocument()
  })

  it("renders one bar per pool when several pools fund different features", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [],
        pools: [
          { periodKind: "daily", usedPercent: 10, resetAt: null, features: ["customAction"] },
          { periodKind: "weekly", usedPercent: 5, resetAt: null, features: ["pageTranslation"] },
        ],
        features: {} as never,
      },
    }

    render(<BuiltInAiUsageConfig />)

    const bars = screen.getAllByRole("progressbar")
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveAttribute("aria-valuenow", "90")
    expect(bars[1]).toHaveAttribute("aria-valuenow", "95")
  })

  it("lists a one-time pool after the recurring ones, with its expiry instead of a reset", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [
          { periodKind: "daily", usedPercent: 40, resetAt: null, features: ["customAction"] },
        ],
        pools: [
          { periodKind: "daily", usedPercent: 40, resetAt: null, features: ["customAction"] },
          {
            periodKind: "once",
            usedPercent: 12.5,
            expiresAt: "2026-11-25T00:00:00.000Z",
            features: ["pageTranslation", "customAction", "videoSubtitles"],
          },
        ],
        features: {} as never,
      },
    }

    render(<BuiltInAiUsageConfig />)

    const bars = screen.getAllByRole("progressbar")
    expect(bars).toHaveLength(2)
    expect(bars[0]).toHaveAttribute("aria-valuenow", "60")
    // 100 - 12.5 rounds to 88.
    expect(bars[1]).toHaveAttribute("aria-valuenow", "88")
    expect(screen.getByText("options.apiProviders.builtInAiUsage.oneTime")).toBeInTheDocument()
    expect(
      screen.getByText("options.apiProviders.builtInAiUsage.supportedFeatures:3"),
    ).toBeInTheDocument()
    const expectedLocalExpiresAt = formatHostedAiResetAtLocal("2026-11-25T00:00:00.000Z")
    expect(
      screen.getByText(`options.apiProviders.builtInAiUsage.expiresAt:${expectedLocalExpiresAt}`),
    ).toBeInTheDocument()
    expect(screen.queryByText(/builtInAiUsage\.resetsAt/)).not.toBeInTheDocument()
  })

  it("shows a one-time pool even when no recurring pool is reported", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [],
        pools: [
          {
            periodKind: "once",
            usedPercent: 100,
            expiresAt: "2026-11-25T00:00:00.000Z",
            features: ["customAction"],
          },
        ],
        features: {} as never,
      },
    }

    render(<BuiltInAiUsageConfig />)

    // A spent one-time pool is still listed until it expires.
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
    expect(screen.queryByText("hostedAi.availability.serviceUnavailable")).not.toBeInTheDocument()
  })

  it("leaves out the expiry when the server sends an unreadable one", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [],
        pools: [
          {
            periodKind: "once",
            usedPercent: 0,
            expiresAt: "not-a-date",
            features: ["customAction"],
          },
        ],
        features: {} as never,
      },
    }

    render(<BuiltInAiUsageConfig />)

    expect(screen.getByText("options.apiProviders.builtInAiUsage.oneTime")).toBeInTheDocument()
    expect(screen.queryByText(/builtInAiUsage\.expiresAt/)).not.toBeInTheDocument()
  })

  // TODO(2026-11-07): delete with the `credits` fallback (mengxi-ream/read-frog-monorepo#710).
  it("reads the recurring pools from credits when the server predates pools", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [
          { periodKind: "weekly", usedPercent: 25, resetAt: null, features: ["pageTranslation"] },
        ],
        features: {} as never,
      },
    }

    render(<BuiltInAiUsageConfig />)

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75")
    expect(screen.getByText("options.apiProviders.builtInAiUsage.weekly")).toBeInTheDocument()
  })
})
