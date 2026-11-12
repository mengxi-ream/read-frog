import type { LogLevel, LogRecord } from "./logger"
import { expect } from "vitest"
import { setupLogging } from "./logger"

/**
 * For tests: every record from here on lands in the returned array, already
 * sanitized exactly as the real sinks would get it. `vitest.setup.ts` resets
 * logging after each test, so nothing leaks into the next one.
 *
 * A test that calls `vi.resetModules()` gets a fresh copy of the logger with
 * every re-import, so it must import this helper the same way, after the reset:
 * `const { captureLogs } = await import("@/utils/logging/testing")`.
 */
export function captureLogs(minLevel: LogLevel = "debug"): LogRecord[] {
  const records: LogRecord[] = []
  setupLogging([{ minLevel, write: (record) => records.push(record) }])
  return records
}

/**
 * Matches a captured record: `expect(logs).toContainEqual(logRecord("warn", "Message"))`.
 * Fields are matched loosely; a logged Error appears as `{ name, message, stack }`.
 */
export function logRecord(level: LogLevel, message: string, fields?: Record<string, unknown>) {
  return expect.objectContaining({
    level,
    message,
    ...(fields ? { fields: expect.objectContaining(fields) } : {}),
  })
}

/** Matches an Error as it appears in a captured record's fields. */
export function loggedError(message: string) {
  return expect.objectContaining({ message })
}
