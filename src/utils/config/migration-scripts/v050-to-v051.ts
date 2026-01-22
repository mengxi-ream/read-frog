/**
 * Migration script from v050 to v051
 * Adds requestQueueConfig and batchQueueConfig to videoSubtitles for independent subtitle translation rate configuration
 *
 * Before (v050):
 *   { ..., videoSubtitles: { enabled, autoStart, style, aiSegmentation } }
 *
 * After (v051):
 *   { ..., videoSubtitles: { enabled, autoStart, style, aiSegmentation, requestQueueConfig, batchQueueConfig } }
 */
export function migrate(oldConfig: any): any {
  // Copy values from translate config for seamless migration
  const requestQueueConfig = oldConfig.translate?.requestQueueConfig ?? {
    capacity: 60,
    rate: 8,
  }
  const batchQueueConfig = oldConfig.translate?.batchQueueConfig ?? {
    maxCharactersPerBatch: 1000,
    maxItemsPerBatch: 4,
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      requestQueueConfig: { ...requestQueueConfig },
      batchQueueConfig: { ...batchQueueConfig },
    },
  }
}
