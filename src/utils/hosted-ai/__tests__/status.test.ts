import type { HostedAiFeature, HostedAiStatus, HostedAiTierStatus } from "../types"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values?.length ? `${key}:${values.join(",")}` : key,
  },
}))

import {
  formatHostedAiResetAtLocal,
  getHostedAiCreditForFeature,
  getHostedAiTierDescription,
  getHostedAiTierStatus,
} from "../status"

const ALL_FEATURES: HostedAiFeature[] = ["pageTranslation", "customAction", "noteSuggestion"]

function tier(overrides: Partial<HostedAiTierStatus> = {}): HostedAiTierStatus {
  return {
    accessAllowed: true,
    available: true,
    unavailableReason: null,
    requiresUltra: false,
    modelRevision: "normal-r7",
    ...overrides,
  }
}

function featureMap(
  entry: (feature: HostedAiFeature) => Record<"normal" | "advance", HostedAiTierStatus>,
): HostedAiStatus["features"] {
  return Object.fromEntries(
    ALL_FEATURES.map((feature) => [feature, entry(feature)]),
  ) as HostedAiStatus["features"]
}

describe("hosted AI status presentation", () => {
  it("shows one shared weekly credit for both model tiers", () => {
    const status: HostedAiStatus = {
      credits: [
        {
          periodKind: "weekly",
          usedPercent: 37.6,
          resetAt: "2026-08-10T00:00:00.000Z",
          features: ALL_FEATURES,
        },
      ],
      features: featureMap(() => ({
        normal: tier(),
        advance: tier({ modelRevision: "advance-r4" }),
      })),
    }

    const credit = getHostedAiCreditForFeature(status, "pageTranslation")
    const normalDescription = getHostedAiTierDescription(
      getHostedAiTierStatus(status, "pageTranslation", "normal"),
      { credit },
    )
    const ultraDescription = getHostedAiTierDescription(
      getHostedAiTierStatus(status, "pageTranslation", "advance"),
      { credit },
    )

    // No dollar figure: the response carries a percentage and a reset time only.
    // The reset moment renders in the runner's local timezone, so the expected
    // string is computed with the same formatter rather than hardcoded.
    expect(normalDescription).toBe(
      `hostedAi.availability.usedPercent:38 · hostedAi.availability.resetsAt:${formatHostedAiResetAtLocal(
        "2026-08-10T00:00:00.000Z",
      )}`,
    )
    expect(ultraDescription).toBe(normalDescription)
    // One pool shared by every feature resolves to the same entry each time.
    expect(getHostedAiCreditForFeature(status, "customAction")).toBe(credit)
  })

  it("shows service unavailability without inventing credit for an unfunded page feature", () => {
    const status: HostedAiStatus = {
      credits: [
        {
          periodKind: "daily",
          usedPercent: 10,
          resetAt: "2026-08-10T00:00:00.000Z",
          features: ["customAction"],
        },
      ],
      features: featureMap((feature) =>
        feature === "customAction"
          ? {
              normal: tier(),
              advance: tier({
                accessAllowed: false,
                available: false,
                unavailableReason: "ultra_required",
                modelRevision: "advance-r4",
              }),
            }
          : {
              normal: tier({ available: false, unavailableReason: "service_unavailable" }),
              advance: tier({
                accessAllowed: false,
                available: false,
                unavailableReason: "ultra_required",
                modelRevision: "advance-r4",
              }),
            },
      ),
    }

    // The daily pool funds Custom Action only, so page translation finds none.
    const credit = getHostedAiCreditForFeature(status, "pageTranslation")
    expect(credit).toBeUndefined()

    expect(
      getHostedAiTierDescription(getHostedAiTierStatus(status, "pageTranslation", "normal"), {
        credit,
      }),
    ).toBe("hostedAi.availability.serviceUnavailable")
    expect(
      getHostedAiTierDescription(getHostedAiTierStatus(status, "pageTranslation", "advance"), {
        credit,
      }),
    ).toBe("hostedAi.availability.ultraRequired")
  })
})
