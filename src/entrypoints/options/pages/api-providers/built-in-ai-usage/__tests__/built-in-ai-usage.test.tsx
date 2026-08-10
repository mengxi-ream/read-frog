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
        credits: [
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
})
