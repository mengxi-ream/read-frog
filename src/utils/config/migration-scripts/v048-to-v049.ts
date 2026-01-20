/**
 * Migration script from v048 to v049
 * Adds aiSegmentation boolean to videoSubtitles
 *
 * Before (v048):
 *   { ..., videoSubtitles: { enabled, autoStart, style } }
 *
 * After (v049):
 *   { ..., videoSubtitles: { enabled, autoStart, style, aiSegmentation: false } }
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      aiSegmentation: false,
    },
  }
}
