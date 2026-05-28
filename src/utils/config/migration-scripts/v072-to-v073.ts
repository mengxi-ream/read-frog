/**
 * Migration script from v072 to v073
 * - Adds requestQueueConfig.timeoutMs for webpage and subtitle translation queues.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
function withDefaultTimeout(requestQueueConfig: any): any {
  return {
    ...requestQueueConfig,
    timeoutMs: typeof requestQueueConfig?.timeoutMs === "number"
      ? requestQueueConfig.timeoutMs
      : 20_000,
  }
}

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      requestQueueConfig: withDefaultTimeout(oldConfig?.translate?.requestQueueConfig),
    },
    videoSubtitles: {
      ...oldConfig?.videoSubtitles,
      requestQueueConfig: withDefaultTimeout(oldConfig?.videoSubtitles?.requestQueueConfig),
    },
  }
}
