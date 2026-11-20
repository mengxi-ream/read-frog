import { beforeEach, describe, expect, it, vi } from "vitest"
import { getBuiltInAiUpgradePlan } from "../built-in-ai-prompt"

const { mockBillingStatus } = vi.hoisted(() => ({
  mockBillingStatus: vi.fn<() => Promise<{ plan: "free" | "pro" | "ultra" }>>(),
}))

vi.mock("@/utils/orpc/client", () => ({
  orpcClient: { billing: { status: mockBillingStatus } },
}))

describe("getBuiltInAiUpgradePlan", () => {
  beforeEach(() => {
    mockBillingStatus.mockReset()
  })

  it.each(["free", "pro"] as const)(
    "returns %s, which has a bigger plan above it",
    async (plan) => {
      mockBillingStatus.mockResolvedValue({ plan })

      await expect(getBuiltInAiUpgradePlan()).resolves.toBe(plan)
    },
  )

  it("returns null for Ultra, which has nothing above it", async () => {
    mockBillingStatus.mockResolvedValue({ plan: "ultra" })

    await expect(getBuiltInAiUpgradePlan()).resolves.toBeNull()
  })

  it("counts a plan it can't read as Free", async () => {
    mockBillingStatus.mockRejectedValue(new Error("Failed to fetch"))

    await expect(getBuiltInAiUpgradePlan()).resolves.toBe("free")
  })
})
