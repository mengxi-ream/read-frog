import { beforeEach, describe, expect, it, vi } from "vitest"

const alarmsGetMock = vi.fn()
const alarmsCreateMock = vi.fn()
const alarmsAddListenerMock = vi.fn()

const translationDeleteMock = vi.fn()
const translationWhereMock = vi.fn()

const requestCountMock = vi.fn()
const requestOrderByToArrayMock = vi.fn()
const requestOrderByLimitMock = vi.fn()
const requestOrderByMock = vi.fn()
const requestBulkDeleteMock = vi.fn()
const requestDeleteByAgeMock = vi.fn()
const requestWhereMock = vi.fn()

const summaryDeleteMock = vi.fn()
const summaryWhereMock = vi.fn()

const loggerInfoMock = vi.fn()
const loggerErrorMock = vi.fn()

vi.mock("#imports", () => ({
  browser: {
    alarms: {
      get: alarmsGetMock,
      create: alarmsCreateMock,
      onAlarm: {
        addListener: alarmsAddListenerMock,
      },
    },
  },
}))

vi.mock("wxt/browser", () => ({
  browser: {
    alarms: {
      get: alarmsGetMock,
      create: alarmsCreateMock,
      onAlarm: {
        addListener: alarmsAddListenerMock,
      },
    },
  },
}))

vi.mock("@/utils/db/dexie/db", () => ({
  db: {
    translationCache: {
      where: translationWhereMock,
      clear: vi.fn(),
    },
    batchRequestRecord: {
      count: requestCountMock,
      orderBy: requestOrderByMock,
      bulkDelete: requestBulkDeleteMock,
      where: requestWhereMock,
      clear: vi.fn(),
    },
    articleSummaryCache: {
      where: summaryWhereMock,
      clear: vi.fn(),
    },
    aiSegmentationCache: {
      clear: vi.fn(),
    },
  },
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}))

describe("setUpDatabaseCleanup", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    alarmsGetMock.mockResolvedValue(null)
    alarmsCreateMock.mockResolvedValue(undefined)

    translationDeleteMock.mockResolvedValue(0)
    translationWhereMock.mockReturnValue({
      below: () => ({
        delete: translationDeleteMock,
      }),
    })

    requestCountMock.mockResolvedValue(0)
    requestOrderByToArrayMock.mockResolvedValue([])
    requestOrderByLimitMock.mockReturnValue({
      toArray: requestOrderByToArrayMock,
    })
    requestOrderByMock.mockReturnValue({
      limit: requestOrderByLimitMock,
    })
    requestBulkDeleteMock.mockResolvedValue(undefined)
    requestDeleteByAgeMock.mockResolvedValue(0)
    requestWhereMock.mockReturnValue({
      below: () => ({
        delete: requestDeleteByAgeMock,
      }),
    })

    summaryDeleteMock.mockResolvedValue(0)
    summaryWhereMock.mockReturnValue({
      below: () => ({
        delete: summaryDeleteMock,
      }),
    })
  })

  it("does not run cleanup immediately on setup", async () => {
    const { setUpDatabaseCleanup } = await import("../db-cleanup")
    await setUpDatabaseCleanup()

    expect(alarmsCreateMock).toHaveBeenCalledTimes(3)
    expect(alarmsAddListenerMock).toHaveBeenCalledTimes(1)

    expect(translationWhereMock).not.toHaveBeenCalled()
    expect(requestCountMock).not.toHaveBeenCalled()
    expect(summaryWhereMock).not.toHaveBeenCalled()
  })

  it("does not recreate alarms when they already exist", async () => {
    alarmsGetMock
      .mockResolvedValueOnce({ name: "cache-cleanup" })
      .mockResolvedValueOnce({ name: "request-record-cleanup" })
      .mockResolvedValueOnce({ name: "summary-cache-cleanup" })

    const { setUpDatabaseCleanup } = await import("../db-cleanup")
    await setUpDatabaseCleanup()

    expect(alarmsCreateMock).not.toHaveBeenCalled()
  })

  it("runs only the matching cleanup handler for each alarm", async () => {
    let alarmListener: ((alarm: { name: string }) => Promise<void>) | undefined
    alarmsAddListenerMock.mockImplementation((listener: (alarm: { name: string }) => Promise<void>) => {
      alarmListener = listener
    })

    const {
      setUpDatabaseCleanup,
      REQUEST_RECORD_CLEANUP_ALARM,
      SUMMARY_CACHE_CLEANUP_ALARM,
      TRANSLATION_CACHE_CLEANUP_ALARM,
    } = await import("../db-cleanup")

    await setUpDatabaseCleanup()
    if (!alarmListener) {
      throw new Error("Alarm listener was not registered")
    }

    await alarmListener({ name: TRANSLATION_CACHE_CLEANUP_ALARM })
    expect(translationWhereMock).toHaveBeenCalledTimes(1)
    expect(requestCountMock).not.toHaveBeenCalled()
    expect(summaryWhereMock).not.toHaveBeenCalled()

    await alarmListener({ name: REQUEST_RECORD_CLEANUP_ALARM })
    expect(requestCountMock).toHaveBeenCalledTimes(1)
    expect(summaryWhereMock).not.toHaveBeenCalled()

    await alarmListener({ name: SUMMARY_CACHE_CLEANUP_ALARM })
    expect(summaryWhereMock).toHaveBeenCalledTimes(1)
  })
})
