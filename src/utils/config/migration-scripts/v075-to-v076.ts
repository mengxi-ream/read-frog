/**
 * Migration script from v075 to v076
 * - Adds fontShadowIntensity and fontStrokeWidth fields with defaults.
 * - Adds lineGap for spacing between main and translation subtitle lines.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function migrateTextStyle(style: any): any {
  if (!style || typeof style !== "object")
    return style
  return {
    ...style,
    fontShadowIntensity: style.fontShadowIntensity ?? 0,
    fontStrokeWidth: style.fontStrokeWidth ?? 0,
  }
}

export function migrate(oldConfig: any): any {
  const oldStyle = oldConfig?.videoSubtitles?.style
  if (!oldStyle || typeof oldStyle !== "object") {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      style: {
        ...oldStyle,
        lineGap: 1.3,
        main: migrateTextStyle(oldStyle.main),
        translation: migrateTextStyle(oldStyle.translation),
      },
    },
  }
}
