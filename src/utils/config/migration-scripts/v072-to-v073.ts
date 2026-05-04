/**
 * Migration script from v072 to v073
 * - Adds `videoSubtitles.style.blurTranslation` with a default value of `false`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig?.videoSubtitles,
      style: {
        ...oldConfig?.videoSubtitles?.style,
        blurTranslation: oldConfig?.videoSubtitles?.style?.blurTranslation ?? false,
      },
    },
  }
}
