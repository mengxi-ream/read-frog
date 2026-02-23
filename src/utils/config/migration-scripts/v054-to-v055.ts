/**
 * Migration script from v054 to v055
 *
 * 1) Enable video subtitles by default for existing users
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      enabled: true,
    },
  }
}
