/* eslint-disable no-console */
import type { LogLevel, LogSink } from "../logger"

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "color:#aaa",
  info: "color:#2196f3",
  warn: "color:#ffb300",
  error: "color:#f44336",
}

/** Prints records to the DevTools console of whichever context logged them. */
export function createConsoleSink(minLevel: LogLevel = "debug"): LogSink {
  return {
    minLevel,
    write: (record) => {
      const args: unknown[] = [`%c[${record.scope}]`, LEVEL_COLORS[record.level], record.message]
      if (Object.keys(record.fields).length > 0) args.push(record.fields)
      console[record.level](...args)
    },
  }
}

/** The console sink in development builds, nothing in production. */
export function createDevConsoleSinks(): LogSink[] {
  return import.meta.env.DEV ? [createConsoleSink()] : []
}
