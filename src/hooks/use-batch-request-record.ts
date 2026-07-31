import { useQuery } from "@tanstack/react-query"
import {
  calculateRequestSavingRatio,
  getRangeBatchRequestRecords,
} from "@/utils/batch-request-record"

/** The window the saving is read over, in days, today included. */
export const SAVING_WINDOW_DAYS = 7

/**
 * The share of requests batching folded away over the last week, as whole percent. `null` while
 * the records load and whenever there is nothing to report — no requests yet, or none batched.
 */
export function useBatchRequestSavingPercent(): number | null {
  const { data: records } = useQuery({
    queryKey: ["batch-request-records", SAVING_WINDOW_DAYS],
    // The range counts back from today, so a 7-day window ends 6 days ago.
    queryFn: () => getRangeBatchRequestRecords(SAVING_WINDOW_DAYS - 1),
  })

  const ratio = records ? calculateRequestSavingRatio(records) : 0
  const percent = Math.round(ratio * 100)
  return percent > 0 ? percent : null
}
