import type { LogRecord, LogSink } from "../logger"
import type { ForwardingLogContext } from "../stored-record"
import { sendMessage } from "@/utils/message"

/**
 * For every context but the background, which owns the local log. A content
 * script could not write it anyway: its IndexedDB belongs to the page it runs
 * on. Records are sent in batches, so a busy page costs one message a second,
 * not one per record.
 */
const FLUSH_DELAY_MS = 1000
export const MAX_FORWARDED_BATCH = 200

export function createForwardSink(context: ForwardingLogContext): LogSink {
  let pending: LogRecord[] = []
  let flushTimer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer)
      flushTimer = undefined
    }
    if (pending.length === 0) return

    const records = pending.slice(-MAX_FORWARDED_BATCH)
    pending = []
    // Fails once the extension is updated, reloaded or disabled under this
    // page; the batch is dropped rather than kept growing.
    sendMessage("storeLogRecords", { context, records }).catch(() => {})
  }

  // The page, or the popup, may never give the timer its second.
  globalThis.addEventListener?.("pagehide", flush)

  return {
    minLevel: "info",
    write: (record) => {
      pending.push(record)
      flushTimer ??= setTimeout(flush, FLUSH_DELAY_MS)
    },
  }
}
