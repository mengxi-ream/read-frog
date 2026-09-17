import { describe, expect, it } from "vitest"
import { getLocalDayKey, nextFeatureActiveDays } from "../feature-active-days"

describe("getLocalDayKey", () => {
  it("formats the user's local calendar day, zero padded", () => {
    expect(getLocalDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05")
    expect(getLocalDayKey(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31")
  })

  it("reads the local day, not UTC", () => {
    // Local midnight is the boundary that matters here; a UTC-based key would report a
    // different day for anyone east or west of UTC at this moment.
    const localMidnight = new Date(2026, 5, 10, 0, 0, 0)
    expect(getLocalDayKey(localMidnight)).toBe("2026-06-10")
  })
})

describe("nextFeatureActiveDays", () => {
  it("writes nothing when today is already counted", () => {
    expect(nextFeatureActiveDays({ lastDay: "2026-09-14", count: 3 }, "2026-09-14")).toBeNull()
  })

  it("counts a new day", () => {
    expect(nextFeatureActiveDays({ lastDay: "2026-09-13", count: 3 }, "2026-09-14")).toEqual({
      lastDay: "2026-09-14",
      count: 4,
    })
  })

  it("counts the very first day", () => {
    expect(nextFeatureActiveDays({ lastDay: "", count: 0 }, "2026-09-14")).toEqual({
      lastDay: "2026-09-14",
      count: 1,
    })
  })

  it("counts a gap of days as one day, not as the days skipped", () => {
    expect(nextFeatureActiveDays({ lastDay: "2026-01-01", count: 1 }, "2026-09-14")).toEqual({
      lastDay: "2026-09-14",
      count: 2,
    })
  })

  it("is idempotent for concurrent first-uses of the same day", () => {
    // Two tabs finish a translation at the same moment: both read yesterday's state and
    // both compute the same next state, so whichever write lands last is still correct.
    // A per-use counter would lose one of the two increments here.
    const current = { lastDay: "2026-09-13", count: 3 }
    const tabA = nextFeatureActiveDays(current, "2026-09-14")
    const tabB = nextFeatureActiveDays(current, "2026-09-14")
    expect(tabA).toEqual(tabB)
    expect(tabA).toEqual({ lastDay: "2026-09-14", count: 4 })
  })
})
