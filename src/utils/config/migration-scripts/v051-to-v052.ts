/**
 * Migration script from v051 to v052
 * Adds customPromptsConfig to videoSubtitles for independent subtitle translation prompts
 *
 * Before (v051):
 *   { ..., videoSubtitles: { enabled, autoStart, style, aiSegmentation, requestQueueConfig, batchQueueConfig } }
 *
 * After (v052):
 *   { ..., videoSubtitles: { enabled, autoStart, style, aiSegmentation, requestQueueConfig, batchQueueConfig, customPromptsConfig } }
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      customPromptsConfig: { promptId: null, patterns: [] },
    },
  }
}
