/**
 * Migration script from v046 to v047
 * Adds text style settings (main, translation) and container settings to videoSubtitles.style
 *
 * Before (v046):
 *   { ..., videoSubtitles: { style: { displayMode, translationPosition } } }
 *
 * After (v047):
 *   { ..., videoSubtitles: { style: { displayMode, translationPosition, main, translation, container } } }
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
        ...oldConfig.videoSubtitles.style,
        main: { ...subtitlesStyle },
        translation: { ...subtitlesStyle },
        container: {
          backgroundOpacity: 75,
        },
      },
    },
  }
}
