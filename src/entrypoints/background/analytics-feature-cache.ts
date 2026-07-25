import type { AnalyticsFeature } from "@/types/analytics"

export const ANALYTICS_DAILY_FEATURE_CACHE_TIME_ZONE = "Asia/Shanghai"

const FEATURE_USAGE_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const featureUsageDayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: ANALYTICS_DAILY_FEATURE_CACHE_TIME_ZONE,
  year: "numeric",
})

export interface FeatureUsageCache {
  getLastReportedDay: (feature: AnalyticsFeature) => Promise<string | undefined>
  setLastReportedDay: (feature: AnalyticsFeature, day: string) => Promise<void>
}

interface FeatureUsageCacheStorage {
  getItem: (key: FeatureUsageCacheStorageKey) => Promise<unknown>
  setItem: (key: FeatureUsageCacheStorageKey, value: unknown) => Promise<void>
}

type FeatureUsageCacheStorageKey = `local:analyticsFeatureUsedLastReportedDay:${AnalyticsFeature}`

export function getFeatureUsageDay(date: Date): string {
  const parts = featureUsageDayFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("Failed to format analytics feature usage day")
  }

  return `${year}-${month}-${day}`
}

export function getFeatureUsageCacheStorageKey(
  feature: AnalyticsFeature,
): FeatureUsageCacheStorageKey {
  return `local:analyticsFeatureUsedLastReportedDay:${feature}`
}

export function createStorageFeatureUsageCache(
  cacheStorage: FeatureUsageCacheStorage,
): FeatureUsageCache {
  return {
    async getLastReportedDay(feature) {
      const value = await cacheStorage.getItem(getFeatureUsageCacheStorageKey(feature))
      return typeof value === "string" && FEATURE_USAGE_DAY_PATTERN.test(value) ? value : undefined
    },
    async setLastReportedDay(feature, day) {
      await cacheStorage.setItem(getFeatureUsageCacheStorageKey(feature), day)
    },
  }
}
