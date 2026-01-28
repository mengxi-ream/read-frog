/**
 * Migration script from v051 to v052
 * Adds new queue configuration parameters:
 * - requestQueueConfig: timeoutMs, maxRetries, baseRetryDelayMs
 * - batchQueueConfig: batchDelay
 *
 * Before (v051):
 *   requestQueueConfig: { capacity, rate }
 *   batchQueueConfig: { maxCharactersPerBatch, maxItemsPerBatch }
 *
 * After (v052):
 *   requestQueueConfig: { capacity, rate, timeoutMs, maxRetries, baseRetryDelayMs }
 *   batchQueueConfig: { maxCharactersPerBatch, maxItemsPerBatch, batchDelay }
 */
export function migrate(oldConfig: any): any {
  // Default values for new fields
  const defaultRequestQueueConfig = {
    timeoutMs: 20_000,
    maxRetries: 2,
    baseRetryDelayMs: 1_000,
  }

  const defaultBatchQueueConfig = {
    batchDelay: 100,
  }

  // Helper to merge requestQueueConfig
  const mergeRequestQueueConfig = (existing: any) => ({
    ...existing,
    ...defaultRequestQueueConfig,
  })

  // Helper to merge batchQueueConfig
  const mergeBatchQueueConfig = (existing: any) => ({
    ...existing,
    ...defaultBatchQueueConfig,
  })

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      requestQueueConfig: mergeRequestQueueConfig(
        oldConfig.translate?.requestQueueConfig ?? {},
      ),
      batchQueueConfig: mergeBatchQueueConfig(
        oldConfig.translate?.batchQueueConfig ?? {},
      ),
    },
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      requestQueueConfig: mergeRequestQueueConfig(
        oldConfig.videoSubtitles?.requestQueueConfig ?? {},
      ),
      batchQueueConfig: mergeBatchQueueConfig(
        oldConfig.videoSubtitles?.batchQueueConfig ?? {},
      ),
    },
  }
}
