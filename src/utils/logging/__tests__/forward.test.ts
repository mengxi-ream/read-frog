// @vitest-environment jsdom
import type { LogRecord } from "../logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createForwardSink, MAX_FORWARDED_BATCH } from "../sinks/forward"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn<(...args: unknown[]) => Promise<void>>(),
}))

vi.mock("@/utils/message", () => ({ sendMessage: sendMessageMock }))

function record(message: string): LogRecord {
  return { time: 0, level: "info", scope: "test", message, fields: {} }
}

describe("createForwardSink", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sendMessageMock.mockReset()
    sendMessageMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("sends the records of the last second to the background in one message", () => {
    const sink = createForwardSink("content")

    sink.write(record("a"))
    sink.write(record("b"))
    expect(sendMessageMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(sendMessageMock).toHaveBeenCalledExactlyOnceWith("storeLogRecords", {
      context: "content",
      records: [record("a"), record("b")],
    })
  })

  it("sends what is left when the page goes away", () => {
    const sink = createForwardSink("popup")

    sink.write(record("closing"))
    window.dispatchEvent(new Event("pagehide"))

    expect(sendMessageMock).toHaveBeenCalledExactlyOnceWith("storeLogRecords", {
      context: "popup",
      records: [record("closing")],
    })
  })

  it("sends at most a batch's worth, the newest", () => {
    const sink = createForwardSink("content")

    for (let index = 0; index < MAX_FORWARDED_BATCH + 5; index++) sink.write(record(`${index}`))
    vi.advanceTimersByTime(1000)

    const { records } = sendMessageMock.mock.calls[0]![1] as { records: LogRecord[] }
    expect(records).toHaveLength(MAX_FORWARDED_BATCH)
    expect(records[0]!.message).toBe("5")
  })

  it("drops the batch when the background cannot be reached", async () => {
    sendMessageMock.mockRejectedValueOnce(new Error("Extension context invalidated."))
    const sink = createForwardSink("content")

    sink.write(record("lost"))
    vi.advanceTimersByTime(1000)
    await Promise.resolve()

    sink.write(record("next"))
    vi.advanceTimersByTime(1000)
    expect(sendMessageMock).toHaveBeenLastCalledWith("storeLogRecords", {
      context: "content",
      records: [record("next")],
    })
  })
})
