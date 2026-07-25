import { describe, expect, it, vi } from "vitest"
import {
  createStorageFeatureUsageCache,
  getFeatureUsageCacheStorageKey,
  getFeatureUsageDay,
} from "../analytics-feature-cache"

describe("analytics feature usage cache", () => {
  it("uses Asia/Shanghai calendar days", () => {
    expect(getFeatureUsageDay(new Date("2026-07-13T15:59:59.999Z"))).toBe("2026-07-13")
    expect(getFeatureUsageDay(new Date("2026-07-13T16:00:00.000Z"))).toBe("2026-07-14")
  })

  it("stores one last-reported day per feature", async () => {
    const values = new Map<string, unknown>()
    const getItem = vi.fn<(key: string) => Promise<unknown>>(async (key) => values.get(key))
    const setItem = vi.fn<(key: string, value: unknown) => Promise<void>>(async (key, value) => {
      values.set(key, value)
    })
    const cache = createStorageFeatureUsageCache({ getItem, setItem })

    await expect(cache.getLastReportedDay("page_translation")).resolves.toBeUndefined()
    await cache.setLastReportedDay("page_translation", "2026-07-14")

    const storageKey = getFeatureUsageCacheStorageKey("page_translation")
    expect(storageKey).toBe("local:analyticsFeatureUsedLastReportedDay:page_translation")
    expect(setItem).toHaveBeenCalledWith(storageKey, "2026-07-14")
    await expect(cache.getLastReportedDay("page_translation")).resolves.toBe("2026-07-14")
  })

  it("treats invalid stored values as cache misses", async () => {
    const cache = createStorageFeatureUsageCache({
      getItem: vi.fn<(key: string) => Promise<unknown>>().mockResolvedValue("not-a-day"),
      setItem: vi.fn<(key: string, value: unknown) => Promise<void>>(),
    })

    await expect(cache.getLastReportedDay("page_translation")).resolves.toBeUndefined()
  })
})
