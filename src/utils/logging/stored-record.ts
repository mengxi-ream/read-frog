import type { LogRecord } from "./logger"

/**
 * Contexts that hand their records to the background (`sinks/forward.ts`). The
 * background owns the local log: it is the one context that is always there to
 * write it, and the only one a content script can reach.
 */
export const FORWARDING_LOG_CONTEXTS = [
  "content",
  "offscreen",
  "options",
  "popup",
  "sidepanel",
  "translation-hub",
] as const
export type ForwardingLogContext = (typeof FORWARDING_LOG_CONTEXTS)[number]

/** Where a record was logged. */
export type LogContext = "background" | ForwardingLogContext

/** A record as kept in the local log, and as it appears in a diagnostics export. */
export interface StoredLogRecord extends LogRecord {
  context: LogContext
  /** The tab a content script logged in. */
  tabId?: number
  /** Host of the page a content script logged on; never the full URL. */
  host?: string
}
