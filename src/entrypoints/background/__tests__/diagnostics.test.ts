import type { StoredLogRecord } from "@/utils/logging/stored-record"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Handler = (message: { data: unknown; sender: unknown }) => unknown

const { onMessageMock, storeLogRecordsMock } = vi.hoisted(() => ({
  onMessageMock: vi.fn<(type: string, handler: Handler) => void>(),
  storeLogRecordsMock: vi.fn<(records: StoredLogRecord[]) => void>(),
}))

vi.mock("@/utils/message", () => ({ onMessage: onMessageMock }))
vi.mock("@/utils/logging/sinks/persist", () => ({ storeLogRecords: storeLogRecordsMock }))
vi.mock("@/utils/diagnostics/report", () => ({
  buildDiagnosticsReport: vi.fn<() => Promise<unknown>>(),
}))

const record = {
  time: 1,
  level: "warn",
  scope: "host/translate",
  message: "Slow",
  fields: { n: 1 },
}

async function getHandler() {
  const { setupDiagnosticsHandlers } = await import("../diagnostics")
  setupDiagnosticsHandlers()
  const [, handler] = onMessageMock.mock.calls.find(([type]) => type === "storeLogRecords")!
  return handler
}

describe("storeLogRecords handler", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("stores a content script's records with its tab and site, not its URL", async () => {
    const handler = await getHandler()

    handler({
      data: { context: "content", records: [record] },
      sender: { tab: { id: 7 }, url: "https://kagi.com/changelog?session=1" },
    })

    expect(storeLogRecordsMock).toHaveBeenCalledExactlyOnceWith([
      { ...record, context: "content", tabId: 7, host: "kagi.com" },
    ])
  })

  it("stores an extension page's records under the page's name", async () => {
    const handler = await getHandler()

    handler({
      data: { context: "options", records: [record] },
      sender: { tab: { id: 3 }, url: "chrome-extension://id/options.html" },
    })

    expect(storeLogRecordsMock).toHaveBeenCalledExactlyOnceWith([{ ...record, context: "options" }])
  })

  it.each([
    ["an unknown context", { context: "background", records: [record] }],
    [
      "a record of the wrong shape",
      { context: "content", records: [{ ...record, level: "fatal" }] },
    ],
    ["a bare array", [record]],
  ])("ignores %s", async (_, data) => {
    const handler = await getHandler()

    handler({ data, sender: {} })

    expect(storeLogRecordsMock).not.toHaveBeenCalled()
  })
})
