// @vitest-environment jsdom
import type { HostedAiStatusResult } from "@/components/llm-providers/use-hosted-ai-status"
import type { HostedAiFeature, HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_ULTRA_PROVIDER_ID,
} from "@/utils/constants/provider-ids"

const { hostedAiState } = vi.hoisted(() => {
  const state: { value: HostedAiStatusResult } = {
    value: { status: undefined, isSignedIn: true, isPending: true, isError: false },
  }
  return { hostedAiState: state }
})

vi.mock("@/components/llm-providers/use-hosted-ai-status", () => ({
  useHostedAiStatus: () => hostedAiState.value,
}))

function systemOption(id: string): ProviderSelectorOption {
  return { kind: "system", id, name: id, logo: () => "logo.png" }
}

function tier(overrides: Partial<HostedAiTierStatus> = {}): HostedAiTierStatus {
  return {
    accessAllowed: true,
    available: true,
    unavailableReason: null,
    requiresUltra: false,
    modelRevision: "r1",
    ...overrides,
  }
}

/** Every hosted feature at fully-available tiers; override per case. */
function allFeatures(
  overrides: Partial<HostedAiStatus["features"]> = {},
): HostedAiStatus["features"] {
  return {
    pageTranslation: { normal: tier(), ultra: tier() },
    customAction: { normal: tier(), ultra: tier() },
    noteSuggestion: { normal: tier(), ultra: tier() },
    selectionTranslation: { normal: tier(), ultra: tier() },
    ...overrides,
  }
}

function dailyCredit(features: HostedAiFeature[], usedPercent = 0) {
  return {
    periodKind: "daily" as const,
    usedPercent,
    resetAt: null,
    features,
  }
}

function customActionDailyCredit(usedPercent = 0) {
  return dailyCredit(["customAction"], usedPercent)
}

const PROVIDERS: ProviderSelectorOption[] = [
  systemOption(BUILT_IN_AI_PROVIDER_ID),
  systemOption(BUILT_IN_AI_ULTRA_PROVIDER_ID),
]

function getDisabled(providers: ProviderSelectorOption[]): Array<boolean | undefined> {
  return providers.map((provider) => ("disabled" in provider ? provider.disabled : undefined))
}

describe("useHostedAiProviderOptions", () => {
  beforeEach(() => {
    hostedAiState.value = { status: undefined, isSignedIn: true, isPending: true, isError: false }
  })

  it("grays out tiers the account has no access to, keeping funded ones selectable", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [customActionDailyCredit()],
        features: allFeatures({
          customAction: {
            normal: tier(),
            ultra: tier({
              accessAllowed: false,
              available: false,
              unavailableReason: "ultra_required",
            }),
          },
        }),
      },
    }

    const { result } = renderHook(() => useHostedAiProviderOptions("customAction", PROVIDERS))

    expect(getDisabled(result.current)).toEqual([false, true])
  })

  it("labels Ultra-gated options from the server's requiresUltra flag", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [customActionDailyCredit()],
        features: allFeatures({
          pageTranslation: {
            normal: tier({ requiresUltra: true }),
            ultra: tier({ requiresUltra: true }),
          },
          customAction: { normal: tier(), ultra: tier({ requiresUltra: true }) },
          noteSuggestion: {
            normal: tier({ requiresUltra: true }),
            ultra: tier({ requiresUltra: true }),
          },
        }),
      },
    }

    const { result } = renderHook(() => useHostedAiProviderOptions("customAction", PROVIDERS))

    const badges = result.current.map((p) => ("requiresUltra" in p ? p.requiresUltra : undefined))
    expect(badges).toEqual([false, true])
  })

  it("grays out a feature no pool funds for this plan, even with access", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        // A free plan funds customAction only — pageTranslation has no pool.
        credits: [customActionDailyCredit()],
        features: allFeatures({
          pageTranslation: {
            normal: tier({ available: false, unavailableReason: "service_unavailable" }),
            ultra: tier({
              accessAllowed: false,
              available: false,
              unavailableReason: "ultra_required",
            }),
          },
        }),
      },
    }

    const { result } = renderHook(() => useHostedAiProviderOptions("pageTranslation", PROVIDERS))

    expect(getDisabled(result.current)).toEqual([true, true])
  })

  it("gates selection translation options on the tier's access verdict", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [dailyCredit(["selectionTranslation"])],
        features: allFeatures({
          selectionTranslation: {
            normal: tier(),
            ultra: tier({
              accessAllowed: false,
              available: false,
              unavailableReason: "ultra_required",
            }),
          },
        }),
      },
    }

    const { result } = renderHook(() =>
      useHostedAiProviderOptions("selectionTranslation", PROVIDERS),
    )

    expect(getDisabled(result.current)).toEqual([false, true])
  })

  it("grays out selection translation when no pool funds it for this plan", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [customActionDailyCredit()],
        features: allFeatures(),
      },
    }

    const { result } = renderHook(() =>
      useHostedAiProviderOptions("selectionTranslation", PROVIDERS),
    )

    expect(getDisabled(result.current)).toEqual([true, true])
  })

  it("gates note suggestion options on access and surfaces the requiresUltra flag", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [dailyCredit(["noteSuggestion"])],
        features: allFeatures({
          noteSuggestion: {
            normal: tier(),
            ultra: tier({
              accessAllowed: false,
              available: false,
              unavailableReason: "ultra_required",
              requiresUltra: true,
            }),
          },
        }),
      },
    }

    const { result } = renderHook(() => useHostedAiProviderOptions("noteSuggestion", PROVIDERS))

    expect(getDisabled(result.current)).toEqual([false, true])
    const badges = result.current.map((p) => ("requiresUltra" in p ? p.requiresUltra : undefined))
    expect(badges).toEqual([false, true])
  })

  it("grays out note suggestion when no pool funds it for this plan", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [customActionDailyCredit()],
        features: allFeatures(),
      },
    }

    const { result } = renderHook(() => useHostedAiProviderOptions("noteSuggestion", PROVIDERS))

    expect(getDisabled(result.current)).toEqual([true, true])
  })

  it("keeps transient outages selectable: exhausted quota or an open circuit never grays", () => {
    hostedAiState.value = {
      isSignedIn: true,
      isPending: false,
      isError: false,
      status: {
        credits: [customActionDailyCredit(100)],
        features: allFeatures({
          customAction: {
            normal: tier({ available: false, unavailableReason: "quota_exhausted" }),
            ultra: tier({ available: false, unavailableReason: "service_unavailable" }),
          },
        }),
      },
    }

    const { result } = renderHook(() => useHostedAiProviderOptions("customAction", PROVIDERS))

    expect(getDisabled(result.current)).toEqual([false, false])
  })

  it("fails open while the status is unknown, instead of latching everything disabled", () => {
    hostedAiState.value = { status: undefined, isSignedIn: true, isPending: false, isError: true }

    const { result } = renderHook(() => useHostedAiProviderOptions("customAction", PROVIDERS))

    expect(getDisabled(result.current)).toEqual([false, false])
  })

  it("returns providers untouched for capabilities without a hosted feature", () => {
    const { result } = renderHook(() => useHostedAiProviderOptions("videoSubtitles", PROVIDERS))

    expect(result.current).toBe(PROVIDERS)
  })

  it("passes local provider configs through unchanged", () => {
    const localProvider = { id: "local-1", name: "Local" } as unknown as ProviderSelectorOption
    hostedAiState.value = { status: undefined, isSignedIn: true, isPending: false, isError: true }

    const { result } = renderHook(() => useHostedAiProviderOptions("customAction", [localProvider]))

    expect(result.current[0]).toBe(localProvider)
  })
})
