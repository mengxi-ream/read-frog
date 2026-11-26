import type { LogSink } from "../logger"
import type { StoredLogRecord } from "../stored-record"
import { db } from "@/utils/db/dexie/db"

/**
 * The local log: the newest records, in the extension's own IndexedDB. Only the
 * background writes it; every other context forwards its records there. Nothing
 * here is ever uploaded — the user exports it when asked (see
 * `utils/diagnostics/report.ts`). Uninstalling the extension deletes it.
 *
 * Records are written in small batches, and after each batch the oldest records
 * past the cap are deleted, so the log never grows past a few megabytes.
 */
export const MAX_STORED_LOG_RECORDS = 3000

const FLUSH_DELAY_MS = 1000

let pending: StoredLogRecord[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined
// One batch at a time: two trims running together would both delete the same excess.
let writing: Promise<void> = Promise.resolve()

async function trimStoredLogRecords(): Promise<void> {
  const excess = (await db.logRecord.count()) - MAX_STORED_LOG_RECORDS
  if (excess <= 0) return
  const oldest = await db.logRecord.orderBy(":id").limit(excess).primaryKeys()
  await db.logRecord.bulkDelete(oldest)
}

async function writeBatch(batch: StoredLogRecord[]): Promise<void> {
  try {
    await db.logRecord.bulkAdd(batch)
    await trimStoredLogRecords()
  } catch {
    // A database that will not take the log has nowhere left to report that to.
  }
}

/** Writes what is queued; resolves once every batch queued so far is written. */
export function flushStoredLogRecords(): Promise<void> {
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  if (pending.length > 0) {
    const batch = pending
    pending = []
    writing = writing.then(() => writeBatch(batch))
  }
  return writing
}

/** Queues records for the local log; they are written within about a second. */
export function storeLogRecords(records: readonly StoredLogRecord[]): void {
  if (records.length === 0) return
  pending.push(...records)
  flushTimer ??= setTimeout(() => void flushStoredLogRecords(), FLUSH_DELAY_MS)
}

/** Oldest first, including anything this context has not written yet. */
export async function readStoredLogRecords(): Promise<StoredLogRecord[]> {
  await flushStoredLogRecords()
  return db.logRecord.orderBy(":id").toArray()
}

/** The background's own records. */
export function createPersistSink(): LogSink {
  return {
    minLevel: "info",
    write: (record) => storeLogRecords([{ ...record, context: "background" }]),
  }
}
