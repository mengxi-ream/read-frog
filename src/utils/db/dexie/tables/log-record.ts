import type { LogLevel } from "@/utils/logging/logger"
import type { JsonObject } from "@/utils/logging/sanitize"
import type { LogContext, StoredLogRecord } from "@/utils/logging/stored-record"
import { Entity } from "dexie"

/** One entry of the local log. Only the newest few thousand are kept; see `sinks/persist.ts`. */
export default class LogRecordEntry extends Entity implements StoredLogRecord {
  id!: number
  time!: number
  level!: LogLevel
  scope!: string
  message!: string
  fields!: JsonObject
  context!: LogContext
  tabId?: number
  host?: string
}
