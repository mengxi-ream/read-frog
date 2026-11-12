import type { LogRecord } from "../logger"
import { describe, expect, it } from "vitest"
import { createLogger, setupLogging } from "../logger"
import { captureLogs, logRecord } from "../testing"

describe("createLogger", () => {
  it("hands every sink the records at or above its level", () => {
    const all: LogRecord[] = []
    const warnings: LogRecord[] = []
    setupLogging([
      { minLevel: "debug", write: (record) => all.push(record) },
      { minLevel: "warn", write: (record) => warnings.push(record) },
    ])
    const log = createLogger("feature")

    log.debug("debug")
    log.info("info")
    log.warn("warn")
    log.error("error")

    expect(all.map((record) => record.level)).toEqual(["debug", "info", "warn", "error"])
    expect(warnings.map((record) => record.message)).toEqual(["warn", "error"])
    expect(all[0]).toEqual({
      time: expect.any(Number),
      level: "debug",
      scope: "feature",
      message: "debug",
      fields: {},
    })
  })

  it("adds the fields bound with `with` to every record, under the call's own", () => {
    const logs = captureLogs()
    const log = createLogger("feature").with({ sessionId: "s1", mode: "bilingual" })

    log.info("Translated", { mode: "translationOnly", count: 2 })

    expect(logs).toEqual([
      logRecord("info", "Translated", { sessionId: "s1", mode: "translationOnly", count: 2 }),
    ])
  })

  it("sanitizes fields before any sink sees them", () => {
    const logs = captureLogs()

    createLogger("provider").error("Request failed", {
      apiKey: "sk-secret",
      error: new Error("boom"),
    })

    expect(logs[0]!.fields).toEqual({
      apiKey: "[redacted]",
      error: expect.objectContaining({ name: "Error", message: "boom" }),
    })
  })

  it("does not touch the fields of a record no sink wants", () => {
    captureLogs("info")
    const fields = {
      get expensive(): string {
        throw new Error("read a field of a dropped record")
      },
    }

    expect(() => createLogger("feature").debug("Skipped", fields)).not.toThrow()
  })

  it("keeps a throwing sink from breaking the caller or the other sinks", () => {
    const records: LogRecord[] = []
    setupLogging([
      {
        minLevel: "debug",
        write: () => {
          throw new Error("sink failed")
        },
      },
      { minLevel: "debug", write: (record) => records.push(record) },
    ])

    expect(() => createLogger("feature").info("Still logged")).not.toThrow()
    expect(records).toEqual([logRecord("info", "Still logged")])
  })
})
