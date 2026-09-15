import { storage } from "#imports"
import { logger } from "./logger"

export const FEATURE_ACTIVE_DAYS_STORAGE_KEY = "featureActiveDays"

const STORAGE_KEY = `local:${FEATURE_ACTIVE_DAYS_STORAGE_KEY}` as const

export interface FeatureActiveDays {
  /** Local calendar day of the most recent successful feature use, as `YYYY-MM-DD`. */
  lastDay: string
  /** How many distinct local days have had at least one successful feature use. */
  count: number
}

const NO_ACTIVE_DAYS: FeatureActiveDays = { lastDay: "", count: 0 }

/**
 * The user's own calendar day, not the analytics reporting day.
 *
 * `analytics-feature-cache` pins its day to Asia/Shanghai so the once-per-day upload
 * throttle lines up with reporting. This answers "how many days of their life has this
 * person used the extension", which is only meaningful in their own timezone. Same
 * shape, different reason to change, so the two deliberately do not share code.
 */
export function getLocalDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseFeatureActiveDays(value: unknown): FeatureActiveDays {
  if (typeof value !== "object" || value === null) return NO_ACTIVE_DAYS

  const { lastDay, count } = value as Partial<FeatureActiveDays>
  if (typeof lastDay !== "string" || typeof count !== "number" || !Number.isFinite(count)) {
    return NO_ACTIVE_DAYS
  }

  return { lastDay, count: Math.max(0, Math.trunc(count)) }
}

export async function getFeatureActiveDays(): Promise<FeatureActiveDays> {
  return parseFeatureActiveDays(await storage.getItem(STORAGE_KEY))
}

/** `null` when `today` has already been counted, which is the common case. */
export function nextFeatureActiveDays(
  current: FeatureActiveDays,
  today: string,
): FeatureActiveDays | null {
  return current.lastDay === today ? null : { lastDay: today, count: current.count + 1 }
}

/**
 * Bumps the count at most once per local day — every later use that day reads and returns
 * without writing, which is what keeps this off the cost of the translation path.
 *
 * Counting days rather than uses also makes concurrent first-uses idempotent instead of
 * racy: two tabs both read yesterday and both write the same `count + 1`, which is the
 * right answer. A per-use counter would have the second write clobber the first.
 *
 * Never throws. It runs fire-and-forget after a translation has already been delivered,
 * so a storage hiccup must not surface as an unhandled rejection.
 */
export async function recordFeatureActiveDay(now: Date = new Date()): Promise<void> {
  try {
    const today = getLocalDayKey(now)
    const next = nextFeatureActiveDays(await getFeatureActiveDays(), today)
    if (!next) return

    await storage.setItem(STORAGE_KEY, next)
  } catch (error) {
    logger.warn("[FeatureActiveDays] Failed to record an active day", error)
  }
}
