/**
 * Migration script from v044 to v045
 * Adds 'style' object to videoSubtitles config with text and container styling options
 *
 * Before (v044):
 *   { ..., videoSubtitles: { enabled: false, autoStart: false } }
 *
 * After (v045):
 *   { ..., videoSubtitles: { enabled: false, autoStart: false, style: { displayMode, translationPosition, main, translation, container } } }
 */
export function migrate(oldConfig: any): any {
  const subtitlesStyle = {
    fontFamily: 'system',
    fontScale: 100,
    color: '#FFFFFF',
    fontWeight: 400,
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      style: {
        displayMode: 'bilingual',
        translationPosition: 'above',
        main: { ...subtitlesStyle },
        translation: { ...subtitlesStyle },
        container: {
          backgroundOpacity: 75,
        },
      },
    },
  }
}
