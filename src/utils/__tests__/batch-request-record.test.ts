import type BatchRequestRecord from "@/utils/db/dexie/tables/batch-request-record"
import { describe, expect, it, vi } from "vitest"
import { calculateRequestSavingRatio } from "../batch-request-record"

// The module reaches for Dexie at import time, which has no IndexedDB to open under vitest.
vi.mock("@/utils/db/dexie/db", () => ({ db: {} }))

function records(...originalRequestCounts: number[]): BatchRequestRecord[] {
  return originalRequestCounts.map(
    (originalRequestCount) => ({ originalRequestCount }) as BatchRequestRecord,
  )
}

describe("calculateRequestSavingRatio", () => {
  it("reports nothing when no request was recorded", () => {
    expect(calculateRequestSavingRatio([])).toBe(0)
  })

  it("reports nothing when every request went out on its own", () => {
    expect(calculateRequestSavingRatio(records(1, 1, 1))).toBe(0)
  })

  it("counts the requests the batches stood in for", () => {
    // 3 requests carried 12 items: 9 of 12 never went out.
    expect(calculateRequestSavingRatio(records(5, 4, 3))).toBeCloseTo(0.75)
  })
})
