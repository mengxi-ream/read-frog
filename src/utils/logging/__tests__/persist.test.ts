import type { StoredLogRecord } from "../stored-record"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// A tiny stand-in for the Dexie table: an auto-increment store kept in order.
const { rows, logRecordTable } = vi.hoisted(() => {
  const store: { id: number; record: StoredLogRecord }[] = []
  let nextId = 1
  const ordered = () => [...store].sort((a, b) => a.id - b.id)
  return {
    rows: store,
    logRecordTable: {
      bulkAdd: vi.fn<(records: StoredLogRecord[]) => Promise<void>>(async (records) => {
        for (const entry of records) store.push({ id: nextId++, record: entry })
      }),
      count: async () => store.length,
      // Like Dexie, a key that is already gone is skipped.
      bulkDelete: async (ids: number[]) => {
        const doomed = new Set(ids)
        store.splice(0, store.length, ...store.filter((row) => !doomed.has(row.id)))
      },
      orderBy: () => ({
        limit: (count: number) => ({
          primaryKeys: async () =>
            ordered()
              .slice(0, count)
              .map((row) => row.id),
        }),
        toArray: async () => ordered().map((row) => row.record),
      }),
    },
  }
})

vi.mock("@/utils/db/dexie/db", () => ({ db: { logRecord: logRecordTable } }))

function record(message: string): StoredLogRecord {
  return { time: 0, level: "info", scope: "test", message, fields: {}, context: "background" }
}

describe("local log", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    rows.length = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("writes queued records in one batch about a second later", async () => {
    const { storeLogRecords } = await import("../sinks/persist")

    storeLogRecords([record("a")])
    storeLogRecords([record("b"), record("c")])
    expect(logRecordTable.bulkAdd).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(logRecordTable.bulkAdd).toHaveBeenCalledExactlyOnceWith([
      record("a"),
      record("b"),
      record("c"),
    ])
  })

  it("keeps only the newest records", async () => {
    const { MAX_STORED_LOG_RECORDS, readStoredLogRecords, storeLogRecords } =
      await import("../sinks/persist")

    storeLogRecords(
      Array.from({ length: MAX_STORED_LOG_RECORDS }, (_, index) => record(`${index}`)),
    )
    await vi.advanceTimersByTimeAsync(1000)
    storeLogRecords([record("newest")])

    const stored = await readStoredLogRecords()
    expect(stored).toHaveLength(MAX_STORED_LOG_RECORDS)
    expect(stored[0]!.message).toBe("1")
    expect(stored.at(-1)!.message).toBe("newest")
  })

  it("includes records not yet written when read", async () => {
    const { readStoredLogRecords, storeLogRecords } = await import("../sinks/persist")

    storeLogRecords([record("pending")])
    expect(await readStoredLogRecords()).toEqual([record("pending")])
  })

  it("stores the background's own records under its name", async () => {
    const { createPersistSink, readStoredLogRecords } = await import("../sinks/persist")

    createPersistSink().write({
      time: 1,
      level: "warn",
      scope: "queue",
      message: "Slow",
      fields: {},
    })

    expect(await readStoredLogRecords()).toEqual([
      {
        time: 1,
        level: "warn",
        scope: "queue",
        message: "Slow",
        fields: {},
        context: "background",
      },
    ])
  })

  it("drops a batch the database refuses instead of throwing", async () => {
    const { flushStoredLogRecords, storeLogRecords } = await import("../sinks/persist")
    logRecordTable.bulkAdd.mockRejectedValueOnce(new Error("QuotaExceededError"))

    storeLogRecords([record("lost")])
    await expect(flushStoredLogRecords()).resolves.toBeUndefined()
    expect(rows).toEqual([])
  })
})
