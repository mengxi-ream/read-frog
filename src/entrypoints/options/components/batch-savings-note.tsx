import { useBatchRequestSavingPercent } from "@/hooks/use-batch-request-record"
import { i18n } from "@/utils/i18n"

/**
 * What batching has actually bought the user, read off the records both queues already write.
 * It sits beside the title rather than in the description because it reports rather than
 * explains, and it renders nothing until there is a saving to report.
 *
 * The figure is the share of requests batching folded away over the last week — "approx."
 * because a request saved is not exactly a proportional amount of spend saved.
 *
 * Blue from `--link` rather than `--accent-blue`: the accent is a fill, tuned to sit behind
 * white content, and its dark value is too dark to read as text on the near-black surface.
 */
export function BatchSavingsNote() {
  const savingPercent = useBatchRequestSavingPercent()

  if (savingPercent === null) {
    return null
  }

  return (
    <span className="text-xs font-medium text-link">
      {i18n.t("options.batchSavings.savedCost", [savingPercent])}
    </span>
  )
}
