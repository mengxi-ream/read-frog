import type { JsonObject } from "./sanitize"
import { sanitizeLogFields, sanitizeLogMessage } from "./sanitize"
import { createDevConsoleSinks } from "./sinks/console"

/**
 * The extension's one logging API. A module creates its logger once, at the top,
 *
 *   const log = createLogger("page-translation")
 *   log.warn("result not cached", { reason: "inline-atom-mismatch" })
 *
 * and never learns where its records go. Each entrypoint decides that once, by
 * calling `setupLogging` with the sinks its context can use — see
 * `setup.ts` and `setup-background.ts`. Every bundle (the
 * background, each content script, each extension page) carries its own copy of
 * this module, so each one sets up its own sinks; until it does, records go to
 * the console in development builds and nowhere in production.
 *
 * Records are sanitized here, once, before any sink sees them (see
 * `sanitize.ts`), so no sink can store or send a secret or a whole page of text
 * by forgetting to.
 */

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const
export type LogLevel = (typeof LOG_LEVELS)[number]

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export type LogFields = Readonly<Record<string, unknown>>

export interface LogRecord {
  time: number
  level: LogLevel
  /** The name the module passed to `createLogger`. */
  scope: string
  message: string
  /** Sanitized and JSON-safe; empty when the call passed no fields. */
  fields: JsonObject
}

export interface LogSink {
  /** Records below this level never reach the sink. */
  minLevel: LogLevel
  write: (record: LogRecord) => void
}

export interface Logger {
  debug: (message: string, fields?: LogFields) => void
  info: (message: string, fields?: LogFields) => void
  warn: (message: string, fields?: LogFields) => void
  error: (message: string, fields?: LogFields) => void
  /** A logger whose records also carry `fields`, e.g. `log.with({ sessionId })`. */
  with: (fields: LogFields) => Logger
}

let sinks: readonly LogSink[] = []
let minSinkRank = Number.POSITIVE_INFINITY

/** Called once by each entrypoint; replaces whatever sinks were set before. */
export function setupLogging(nextSinks: readonly LogSink[]): void {
  sinks = nextSinks
  minSinkRank = Math.min(...nextSinks.map((sink) => LEVEL_RANK[sink.minLevel]))
}

/** Back to what a bundle has before its entrypoint sets logging up. Tests reset with this. */
export function resetLogging(): void {
  setupLogging(createDevConsoleSinks())
}

resetLogging()

export function isLogLevelAtLeast(level: LogLevel, minLevel: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel]
}

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  bound: LogFields,
  fields: LogFields,
): void {
  const rank = LEVEL_RANK[level]
  // Debug records are dropped in production; spend nothing on them there.
  if (rank < minSinkRank) return

  const record: LogRecord = {
    time: Date.now(),
    level,
    scope,
    message: sanitizeLogMessage(message),
    fields: sanitizeLogFields({ ...bound, ...fields }),
  }
  for (const sink of sinks) {
    if (rank < LEVEL_RANK[sink.minLevel]) continue
    try {
      sink.write(record)
    } catch {
      // A sink that throws must never break the code that logged.
    }
  }
}

export function createLogger(scope: string, bound: LogFields = {}): Logger {
  const at =
    (level: LogLevel) =>
    (message: string, fields: LogFields = {}): void =>
      emit(level, scope, message, bound, fields)

  return {
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
    with: (fields) => createLogger(scope, { ...bound, ...fields }),
  }
}
