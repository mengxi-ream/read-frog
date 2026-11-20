import type { ProviderConfig } from "@/types/config/provider"
import type { HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  LUNA_PROVIDER_ID,
  SOL_PROVIDER_ID,
  testHostedAiModels,
} from "@/utils/hosted-ai/__tests__/test-models"
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
    upgradeTo: null,
    modelRevision: "r1",
    ...overrides,
  }
}

/** Every feature at the same pair of tiers, which is all these cases need. */
function statusWith(
  normal: HostedAiTierStatus,
  advance = normal,
  models: HostedAiStatus["models"] = testHostedAiModels(),
): HostedAiStatus {
  const entry = { normal, advance }
  return {
    pools: [],
    models,
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
    expect(isDurablyUnusableTier(tier({ unavailableReason: "pro_required" }))).toBe(true)
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

    expect(isProviderIdDurablyUnusable(LUNA_PROVIDER_ID, "pageTranslation", status)).toBe(true)
  })

  it("judges each model by its own tier", () => {
    const status = statusWith(tier(), tier({ unavailableReason: "ultra_required" }))

    expect(isProviderIdDurablyUnusable(LUNA_PROVIDER_ID, "pageTranslation", status)).toBe(false)
    expect(isProviderIdDurablyUnusable(SOL_PROVIDER_ID, "pageTranslation", status)).toBe(true)
  })

  it("leaves a model the list does not name to the server", () => {
    const status = statusWith(tier({ unavailableReason: "ultra_required" }))

    expect(isProviderIdDurablyUnusable("read-frog-ai:gpt-5-mini", "pageTranslation", status)).toBe(
      false,
    )
  })

  it("keeps a built-in usable while its quota is merely exhausted", () => {
    const status = statusWith(tier({ available: false, unavailableReason: "quota_exhausted" }))

    expect(isProviderIdDurablyUnusable(LUNA_PROVIDER_ID, "pageTranslation", status)).toBe(false)
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

  it("counts the default model when there is no status to judge or list models by", () => {
    expect(getUsableProviderIdsForCapability("pageTranslation", [], undefined)).toEqual([
      LUNA_PROVIDER_ID,
    ])
  })

  it("lists every model the plan reaches, the default model ahead of the rest", () => {
    const advanceWalled = statusWith(tier(), tier({ unavailableReason: "ultra_required" }))

    expect(
      getUsableProviderIdsForCapability(
        "pageTranslation",
        [providerById("google-translate-default")],
        advanceWalled,
      ),
    ).toEqual([
      "google-translate-default",
      LUNA_PROVIDER_ID,
      "read-frog-ai:claude-haiku-5-5",
      "read-frog-ai:deepseek-v4.1-flash",
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
        providerId: LUNA_PROVIDER_ID,
        model: "gpt-6-luna",
        modelTier: "normal",
        modelRevision: "r1",
        reasoning: null,
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
