/**
 * Migration script from v044 to v045
 * Adds 'style' object to videoSubtitles config
 *
 * Before (v044):
 *   { ..., videoSubtitles: { enabled: false, autoStart: false } }
 *
 * After (v045):
 *   { ..., videoSubtitles: { enabled: false, autoStart: false, style: { displayMode: 'bilingual', translationPosition: 'above' } } }
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      style: {
        displayMode: 'bilingual',
        translationPosition: 'above',
      },
    },
  }
}
