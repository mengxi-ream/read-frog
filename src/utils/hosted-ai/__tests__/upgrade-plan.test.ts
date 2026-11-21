import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getBuiltInAiUpgradePlan, resetBuiltInAiUpgradePlanCache } from "../upgrade-plan"

const { mockBillingStatus } = vi.hoisted(() => ({
  mockBillingStatus: vi.fn<() => Promise<{ plan: "free" | "pro" | "ultra" }>>(),
}))

vi.mock("@/utils/orpc/client", () => ({
  orpcClient: { billing: { status: mockBillingStatus } },
}))

describe("getBuiltInAiUpgradePlan", () => {
  beforeEach(() => {
    mockBillingStatus.mockReset()
    resetBuiltInAiUpgradePlanCache()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it("reads the plan once for refusals that arrive together or within a minute", async () => {
    vi.useFakeTimers()
    mockBillingStatus.mockResolvedValue({ plan: "pro" })

    const together = await Promise.all([getBuiltInAiUpgradePlan(), getBuiltInAiUpgradePlan()])
    vi.advanceTimersByTime(59_000)
    const later = await getBuiltInAiUpgradePlan()

    expect(together).toEqual(["pro", "pro"])
    expect(later).toBe("pro")
    expect(mockBillingStatus).toHaveBeenCalledOnce()

    // After a minute it reads again: the account may have upgraded.
    mockBillingStatus.mockResolvedValue({ plan: "ultra" })
    vi.advanceTimersByTime(2_000)
    await expect(getBuiltInAiUpgradePlan()).resolves.toBeNull()
    expect(mockBillingStatus).toHaveBeenCalledTimes(2)
  })
})
