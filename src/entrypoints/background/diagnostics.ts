import { z } from "zod"
import { buildDiagnosticsReport } from "@/utils/diagnostics/report"
import { LOG_LEVELS } from "@/utils/logging/logger"
import { MAX_FORWARDED_BATCH } from "@/utils/logging/sinks/forward"
import { storeLogRecords } from "@/utils/logging/sinks/persist"
import { FORWARDING_LOG_CONTEXTS } from "@/utils/logging/stored-record"
import { onMessage } from "@/utils/message"

const forwardedRecordsSchema = z.object({
  context: z.enum(FORWARDING_LOG_CONTEXTS),
  records: z
    .array(
      z.object({
        time: z.number(),
        level: z.enum(LOG_LEVELS),
        scope: z.string().max(200),
        message: z.string().max(2000),
        fields: z.record(z.string(), z.json()),
      }),
    )
    .max(MAX_FORWARDED_BATCH),
})

function getHost(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).host || undefined
  } catch {
    return undefined
  }
}

export function setupDiagnosticsHandlers(): void {
  // What the other contexts log; a content script's records also get its tab and site.
  onMessage("storeLogRecords", ({ data, sender }) => {
    const parsed = forwardedRecordsSchema.safeParse(data)
    if (!parsed.success) return

    const { context, records } = parsed.data
    const origin = context === "content" ? { tabId: sender.tab?.id, host: getHost(sender.url) } : {}
    storeLogRecords(records.map((record) => ({ ...record, context, ...origin })))
  })

  onMessage("getDiagnosticsReport", () => buildDiagnosticsReport())
}
