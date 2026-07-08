import { beforeEach, describe, expect, it, vi } from "vitest"

const alarmsGetMock = vi.fn<(...args: any[]) => any>()
const alarmsCreateMock = vi.fn<(...args: any[]) => any>()
const alarmsAddListenerMock = vi.fn<(...args: any[]) => any>()

const translationDeleteMock = vi.fn<(...args: any[]) => any>()
const translationWhereMock = vi.fn<(...args: any[]) => any>()

const requestCountMock = vi.fn<(...args: any[]) => any>()
const requestOrderByToArrayMock = vi.fn<(...args: any[]) => any>()
const requestOrderByLimitMock = vi.fn<(...args: any[]) => any>()
const requestOrderByMock = vi.fn<(...args: any[]) => any>()
const requestBulkDeleteMock = vi.fn<(...args: any[]) => any>()
const requestDeleteByAgeMock = vi.fn<(...args: any[]) => any>()
const requestWhereMock = vi.fn<(...args: any[]) => any>()

const summaryDeleteMock = vi.fn<(...args: any[]) => any>()
const summaryWhereMock = vi.fn<(...args: any[]) => any>()

const loggerInfoMock = vi.fn<(...args: any[]) => any>()
const loggerErrorMock = vi.fn<(...args: any[]) => any>()

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
      clear: vi.fn<(...args: any[]) => any>(),
    },
    batchRequestRecord: {
      count: requestCountMock,
      orderBy: requestOrderByMock,
      bulkDelete: requestBulkDeleteMock,
      where: requestWhereMock,
      clear: vi.fn<(...args: any[]) => any>(),
    },
    articleSummaryCache: {
      where: summaryWhereMock,
      clear: vi.fn<(...args: any[]) => any>(),
    },
    aiSegmentationCache: {
      clear: vi.fn<(...args: any[]) => any>(),
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
    alarmsAddListenerMock.mockImplementation(
      (listener: (alarm: { name: string }) => Promise<void>) => {
        alarmListener = listener
      },
    )

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
