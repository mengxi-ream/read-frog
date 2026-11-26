import { describe, expect, it, vi } from "vitest"
import { getHostedAiModelUnavailableReason } from "@/utils/hosted-ai/model-errors"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, values?: Array<string | number>) =>
      values ? `${key}:${values.join("|")}` : key,
  },
  formatUiAlternatives: (items: readonly string[]) => items.join(" or "),
}))

describe("getHostedAiModelUnavailableReason", () => {
  it("says a listed model is temporarily unavailable and names what to try", () => {
    expect(getHostedAiModelUnavailableReason("GPT-6.2 Sol", "temporary", ["GPT-6 Luna"])).toBe(
      "hostedAi.unavailable.temporary:GPT-6.2 Sol|GPT-6 Luna",
    )
  })

  it("says a dropped model is no longer offered", () => {
    expect(getHostedAiModelUnavailableReason("gpt-5-mini", "removed", ["GPT-6 Luna"])).toBe(
      "hostedAi.unavailable.removed:gpt-5-mini|GPT-6 Luna",
    )
  })

  it("names at most three models to switch to", () => {
    expect(
      getHostedAiModelUnavailableReason("GPT-6.2 Sol", "temporary", ["A", "B", "C", "D"]),
    ).toBe("hostedAi.unavailable.temporary:GPT-6.2 Sol|A or B or C")
  })

  it("has its own wording when there is nothing to switch to", () => {
    expect(getHostedAiModelUnavailableReason("GPT-6.2 Sol", "temporary", [])).toBe(
      "hostedAi.unavailable.temporaryNoAlternatives:GPT-6.2 Sol",
    )
    expect(getHostedAiModelUnavailableReason("gpt-5-mini", "removed", [])).toBe(
      "hostedAi.unavailable.removedNoAlternatives:gpt-5-mini",
    )
  })
})
