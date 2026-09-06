import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { alarms, cacheTables, requestTable, loggerMock } = vi.hoisted(() => {
  function createTableMock() {
    const deleteEntries = vi.fn<() => Promise<number>>()
    const below = vi.fn<(cutoff: Date) => { delete: typeof deleteEntries }>()
    const where = vi.fn<(index: string) => { below: typeof below }>()
    const clear = vi.fn<() => Promise<void>>()
    return { where, below, delete: deleteEntries, clear }
  }

  const toArray = vi.fn<() => Promise<{ key: string }[]>>()
  const limit = vi.fn<(count: number) => { toArray: typeof toArray }>()
  return {
    alarms: {
      get: vi.fn<(name: string) => Promise<{ name: string } | null>>(),
      create: vi.fn<(name: string, schedule: object) => Promise<void>>(),
      onAlarm: {
        addListener: vi.fn<(listener: (alarm: { name: string }) => Promise<void>) => void>(),
      },
    },
    cacheTables: {
      translationCache: createTableMock(),
      articleSummaryCache: createTableMock(),
      aiSegmentationCache: createTableMock(),
    },
    requestTable: {
      ...createTableMock(),
      count: vi.fn<() => Promise<number>>(),
      orderBy: vi.fn<(index: string) => { limit: typeof limit }>(),
      limit,
      toArray,
      bulkDelete: vi.fn<(keys: string[]) => Promise<void>>(),
    },
    loggerMock: {
      info: vi.fn<(message: string) => void>(),
      error: vi.fn<(message: string, error: unknown) => void>(),
    },
  }
})

vi.mock("#imports", () => ({ browser: { alarms } }))
vi.mock("wxt/browser", () => ({ browser: { alarms } }))
vi.mock("@/utils/db/dexie/db", () => ({
  db: { ...cacheTables, batchRequestRecord: requestTable },
}))
vi.mock("@/utils/logger", () => ({ logger: loggerMock }))

const caches = [
  {
    alarm: "cache-cleanup",
    table: cacheTables.translationCache,
    label: "Translation cache",
    clear: "cleanupAllTranslationCache",
  },
  {
    alarm: "summary-cache-cleanup",
    table: cacheTables.articleSummaryCache,
    label: "Summary cache",
    clear: "cleanupAllSummaryCache",
  },
  {
    alarm: "ai-segmentation-cache-cleanup",
    table: cacheTables.aiSegmentationCache,
    label: "AI segmentation cache",
    clear: "cleanupAllAiSegmentationCache",
  },
] as const

const jobs = [
  ...caches,
  { alarm: "request-record-cleanup", table: requestTable, clear: "cleanupAllRequestRecords" },
] as const

async function setUpAlarmListener() {
  const { setUpDatabaseCleanup } = await import("../db-cleanup")
  await setUpDatabaseCleanup()
  return alarms.onAlarm.addListener.mock.calls[0]![0]
}

describe("database cleanup", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-05T12:30:00.000Z"))

    alarms.get.mockResolvedValue(null)
    alarms.create.mockResolvedValue(undefined)

    for (const { table } of jobs) {
      table.delete.mockResolvedValue(0)
      table.below.mockReturnValue({ delete: table.delete })
      table.where.mockReturnValue({ below: table.below })
      table.clear.mockResolvedValue(undefined)
    }

    requestTable.count.mockResolvedValue(0)
    requestTable.toArray.mockResolvedValue([])
    requestTable.limit.mockReturnValue({ toArray: requestTable.toArray })
    requestTable.orderBy.mockReturnValue({ limit: requestTable.limit })
    requestTable.bulkDelete.mockResolvedValue(undefined)
  })

  afterEach(() => vi.useRealTimers())

  it("creates daily alarms with a one-minute delay without running cleanup on setup", async () => {
    await setUpAlarmListener()

    expect(alarms.create).toHaveBeenCalledTimes(4)
    expect(alarms.onAlarm.addListener).toHaveBeenCalledTimes(1)
    for (const { alarm, table } of jobs) {
      expect(alarms.create).toHaveBeenCalledWith(alarm, {
        delayInMinutes: 1,
        periodInMinutes: 1440,
      })
      expect(table.where).not.toHaveBeenCalled()
    }
    expect(requestTable.count).not.toHaveBeenCalled()
  })

  it("registers the listener before awaiting existing alarms", async () => {
    const { setUpDatabaseCleanup } = await import("../db-cleanup")
    const setup = setUpDatabaseCleanup()

    expect(alarms.onAlarm.addListener).toHaveBeenCalledTimes(1)
    const listener = alarms.onAlarm.addListener.mock.calls[0]![0]
    await listener({ name: "cache-cleanup" })
    expect(cacheTables.translationCache.delete).toHaveBeenCalledTimes(1)
    await setup
  })

  it("does not recreate alarms when they already exist", async () => {
    alarms.get.mockImplementation(async (name) => ({ name }))
    await setUpAlarmListener()

    expect(alarms.create).not.toHaveBeenCalled()
  })

  it.each(jobs)("adds missing $alarm alongside existing alarms", async ({ alarm }) => {
    alarms.get.mockImplementation(async (name) => (name === alarm ? null : { name }))
    await setUpAlarmListener()

    expect(alarms.create).toHaveBeenCalledExactlyOnceWith(alarm, {
      delayInMinutes: 1,
      periodInMinutes: 1440,
    })
  })

  it.each(jobs)("runs only the matching cleanup for $alarm", async ({ alarm, table }) => {
    const listener = await setUpAlarmListener()
    await listener({ name: alarm })

    for (const job of jobs) {
      expect(job.table.delete).toHaveBeenCalledTimes(job.table === table ? 1 : 0)
      expect(job.table.clear).not.toHaveBeenCalled()
    }
    expect(requestTable.count).toHaveBeenCalledTimes(table === requestTable ? 1 : 0)
  })

  it("ignores unrelated alarms", async () => {
    const listener = await setUpAlarmListener()
    await listener({ name: "unrelated-alarm" })

    for (const { table } of jobs) {
      expect(table.where).not.toHaveBeenCalled()
    }
    expect(requestTable.count).not.toHaveBeenCalled()
  })

  it.each(caches)(
    "expires $label using a fresh seven-day createdAt cutoff on each run",
    async ({ alarm, table, label }) => {
      table.delete.mockResolvedValue(3)
      const listener = await setUpAlarmListener()
      await listener({ name: alarm })

      expect(table.where).toHaveBeenCalledExactlyOnceWith("createdAt")
      expect(table.below).toHaveBeenCalledExactlyOnceWith(new Date("2026-08-29T12:30:00.000Z"))
      expect(table.delete).toHaveBeenCalledTimes(1)
      expect(loggerMock.info).toHaveBeenCalledWith(`${label} cleanup: Deleted 3 old entries`)

      vi.setSystemTime(new Date("2026-09-06T12:30:00.000Z"))
      await listener({ name: alarm })
      expect(table.below).toHaveBeenLastCalledWith(new Date("2026-08-30T12:30:00.000Z"))
    },
  )

  it.each(caches)("does not log when $label has no expired entries", async ({ alarm }) => {
    const listener = await setUpAlarmListener()
    await listener({ name: alarm })

    expect(loggerMock.info).not.toHaveBeenCalled()
  })

  it.each(caches)(
    "logs $label failures without rejecting or preventing later cleanup",
    async ({ alarm, table, label }) => {
      const error = new Error("Database unavailable")
      table.delete.mockRejectedValueOnce(error)
      const listener = await setUpAlarmListener()

      await expect(listener({ name: alarm })).resolves.toBeUndefined()
      expect(loggerMock.error).toHaveBeenCalledExactlyOnceWith(
        `Failed to cleanup old ${label}:`,
        error,
      )
      expect(loggerMock.info).not.toHaveBeenCalled()

      table.delete.mockResolvedValueOnce(2)
      await listener({ name: alarm })
      expect(loggerMock.info).toHaveBeenCalledWith(`${label} cleanup: Deleted 2 old entries`)
    },
  )

  it("trims excess request records oldest first and also expires records older than 120 days", async () => {
    requestTable.count.mockResolvedValue(10002)
    requestTable.toArray.mockResolvedValue([{ key: "oldest" }, { key: "next-oldest" }])
    const listener = await setUpAlarmListener()
    await listener({ name: "request-record-cleanup" })

    expect(requestTable.orderBy).toHaveBeenCalledExactlyOnceWith("createdAt")
    expect(requestTable.limit).toHaveBeenCalledExactlyOnceWith(2)
    expect(requestTable.bulkDelete).toHaveBeenCalledExactlyOnceWith(["oldest", "next-oldest"])
    expect(requestTable.where).toHaveBeenCalledExactlyOnceWith("createdAt")
    expect(requestTable.below).toHaveBeenCalledExactlyOnceWith(new Date("2026-05-08T12:30:00.000Z"))
    expect(requestTable.delete).toHaveBeenCalledTimes(1)
  })

  it.each([9999, 10000])(
    "still expires request records without trimming a count of %i",
    async (count) => {
      requestTable.count.mockResolvedValue(count)
      const listener = await setUpAlarmListener()
      await listener({ name: "request-record-cleanup" })

      expect(requestTable.orderBy).not.toHaveBeenCalled()
      expect(requestTable.bulkDelete).not.toHaveBeenCalled()
      expect(requestTable.below).toHaveBeenCalledExactlyOnceWith(
        new Date("2026-05-08T12:30:00.000Z"),
      )
      expect(requestTable.delete).toHaveBeenCalledTimes(1)
    },
  )

  it("logs request cleanup failures without rejecting the alarm handler", async () => {
    const error = new Error("Database unavailable")
    requestTable.count.mockRejectedValueOnce(error)
    const listener = await setUpAlarmListener()

    await expect(listener({ name: "request-record-cleanup" })).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith("Failed to cleanup old request records:", error)
  })

  it.each(jobs)("propagates manual $clear failures to the caller", async ({ table, clear }) => {
    const error = new Error("Database unavailable")
    table.clear.mockRejectedValueOnce(error)
    const cleanup = await import("../db-cleanup")

    await expect(cleanup[clear]()).rejects.toBe(error)
    expect(table.clear).toHaveBeenCalledTimes(1)
  })
})
