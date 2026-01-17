/**
 * Migration script from v047 to v048
 * Adds text style settings (main, translation) and container settings to videoSubtitles.style
 *
 * Before (v047):
 *   { ..., videoSubtitles: { style: { ... } } }
 *
 * After (v048):
 *   { ..., videoSubtitles: { style: { ..., main, translation, container } } }
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
