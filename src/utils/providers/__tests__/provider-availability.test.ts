import type { ProviderConfig } from "@/types/config/provider"
import type { HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  getUsableProviderIdsForCapability,
  isDurablyUnusableTier,
  isProviderIdDurablyUnusable,
} from "../provider-availability"
import { canProviderRefGenerateText } from "../provider-ref"

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

/** Every feature at the same pair of tiers, which is all these cases need. */
function statusWith(normal: HostedAiTierStatus, advance = normal): HostedAiStatus {
  const entry = { normal, advance }
  return {
    credits: [],
    features: {
      pageTranslation: entry,
      customAction: entry,
      noteSuggestion: entry,
      selectionTranslation: entry,
      videoSubtitles: entry,
      inputTranslation: entry,
      languageDetection: entry,
    },
  }
}

function providerById(id: string): ProviderConfig {
  const provider = DEFAULT_CONFIG.providersConfig.find((item) => item.id === id)
  if (!provider) throw new Error(`Provider "${id}" not found`)
  return provider
}

describe("isDurablyUnusableTier", () => {
  it("treats sign-in and plan walls as durable", () => {
    // Both are things the user can act on and that will not resolve on their own.
    expect(isDurablyUnusableTier(tier({ unavailableReason: "authentication_required" }))).toBe(true)
    expect(isDurablyUnusableTier(tier({ unavailableReason: "ultra_required" }))).toBe(true)
  })

  it("treats every service-state reason as transient", () => {
    // An exhausted quota comes back, a circuit closes, a billing lookup that
    // threw succeeds on retry. None of them mean the provider is walled off,
    // and `service_unavailable` is what the server sends for all three.
    expect(isDurablyUnusableTier(tier({ unavailableReason: "quota_exhausted" }))).toBe(false)
    expect(isDurablyUnusableTier(tier({ unavailableReason: "service_unavailable" }))).toBe(false)
  })

  it("reads an unknown tier as usable", () => {
    // Not knowing is not the same as knowing it is walled off — failing closed
    // here would block deletes whenever the status endpoint hiccups.
    expect(isDurablyUnusableTier(undefined)).toBe(false)
    expect(isDurablyUnusableTier(tier())).toBe(false)
  })
})

describe("isProviderIdDurablyUnusable", () => {
  it("never reports a local provider as durably unusable", () => {
    // A local provider carries its own credentials; hosted status says nothing
    // about it, even when every hosted tier is walled off.
    const status = statusWith(tier({ unavailableReason: "ultra_required" }))

    expect(isProviderIdDurablyUnusable("openai-default", "pageTranslation", status)).toBe(false)
  })

  it("reports a built-in walled off by plan", () => {
    const status = statusWith(tier({ unavailableReason: "ultra_required" }))

    expect(isProviderIdDurablyUnusable("read-frog-free-ai", "pageTranslation", status)).toBe(true)
  })

  it("keeps a built-in usable while its quota is merely exhausted", () => {
    const status = statusWith(tier({ available: false, unavailableReason: "quota_exhausted" }))

    expect(isProviderIdDurablyUnusable("read-frog-free-ai", "pageTranslation", status)).toBe(false)
  })
})

describe("getUsableProviderIdsForCapability", () => {
  const walledOff = statusWith(tier({ unavailableReason: "ultra_required" }))

  it("drops walled-off built-ins while keeping local providers", () => {
    const ids = getUsableProviderIdsForCapability(
      "pageTranslation",
      [providerById("google-translate-default")],
      walledOff,
    )

    expect(ids).toEqual(["google-translate-default"])
  })

  it("returns nothing when the only providers left are walled-off built-ins", () => {
    // This is the state the delete guard exists to prevent: the capability list
    // is non-empty (the built-ins are always in it) but nothing in it can run.
    expect(getUsableProviderIdsForCapability("pageTranslation", [], walledOff)).toEqual([])
  })

  it("counts the built-ins when there is no status to judge them by", () => {
    expect(getUsableProviderIdsForCapability("pageTranslation", [], undefined)).toEqual([
      "read-frog-free-ai",
      "read-frog-advance-ai",
    ])
  })
})

describe("canProviderRefGenerateText", () => {
  it("accepts a local LLM and the built-ins", () => {
    expect(
      canProviderRefGenerateText({
        kind: "local",
        config: providerById("openai-default") as never,
      }),
    ).toBe(true)
    expect(
      canProviderRefGenerateText({
        kind: "system",
        providerId: "read-frog-free-ai",
        modelTier: "normal",
        modelRevision: "r1",
      }),
    ).toBe(true)
  })

  it("rejects a translate-only provider even though it can run subtitles", () => {
    // The videoSubtitles capability admits Google, so it resolves into a
    // perfectly valid ref — it just has no model to prompt for a summary.
    expect(
      canProviderRefGenerateText({
        kind: "local",
        config: providerById("google-translate-default") as never,
      }),
    ).toBe(false)
  })
})
