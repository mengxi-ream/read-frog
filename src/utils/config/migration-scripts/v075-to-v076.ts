/**
 * Migration script from v075 to v076
 * - Adds fontShadowIntensity and fontStrokeWidth fields with new defaults.
 * - Adds lineGap (px) for spacing between main and translation subtitle lines.
 * - Adds backgroundStyle for subtitle container background appearance.
 * - Adds presetStyle for style presets (replaces mode: "basic"|"advanced").
 * - Adds backgroundForceMerge toggle for merging subtitle backgrounds.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function migrateTextStyle(style: any, shadow: number, stroke: number): any {
  if (!style || typeof style !== "object")
    return style
  return {
    ...style,
    fontShadowIntensity: style.fontShadowIntensity ?? shadow,
    fontStrokeWidth: style.fontStrokeWidth ?? stroke,
  }
}

export function migrate(oldConfig: any): any {
  const oldStyle = oldConfig?.videoSubtitles?.style
  if (!oldStyle || typeof oldStyle !== "object") {
    return oldConfig
  }

  const { mode, ...cleanStyle } = oldStyle

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig.videoSubtitles,
      style: {
        ...cleanStyle,
        presetStyle: oldStyle.presetStyle ?? 2,
        backgroundForceMerge: oldStyle.backgroundForceMerge ?? true,
        lineGap: 4,
        container: {
          ...(oldStyle.container || {}),
          backgroundStyle: oldStyle.container?.backgroundStyle
            ?? (oldStyle.container?.backgroundOpacity ? "blur" : "none"),
          backgroundOpacity: oldStyle.container?.backgroundOpacity ?? 50,
        },
        main: migrateTextStyle(oldStyle.main, 3, 3),
        translation: migrateTextStyle(oldStyle.translation, 3, 3),
      },
    },
  }
}
