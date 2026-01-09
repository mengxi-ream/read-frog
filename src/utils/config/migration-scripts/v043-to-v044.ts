/**
 * Migration script from v043 to v044
 * Adds 'autoStart' to videoSubtitles config
 *
 * Before (v043):
 *   { ..., videoSubtitles: { enabled: false } }
 *
 * After (v044):
 *   { ..., videoSubtitles: { enabled: false, autoStart: false } }
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      autoStart: false,
    },
  }
}
