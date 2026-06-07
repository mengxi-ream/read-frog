/**
 * Migration script from v075 to v076
 * - Replaces shadow/stroke boolean toggles with intensity/width sliders.
 *   shadow -> shadowIntensity (0-100), stroke -> strokeWidth (0-3)
 *   When shadow was true, shadowIntensity defaults to 50.
 *   When stroke was true, strokeWidth defaults to 1.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function migrateTextStyle(style: any): any {
  if (!style || typeof style !== "object") {
    return style
  }

  const shadowEnabled = style.shadow !== false
  const strokeEnabled = style.stroke !== false

  const result: Record<string, unknown> = {}

  for (const key of Object.keys(style)) {
    if (key !== "shadow" && key !== "stroke") {
      result[key] = style[key]
    }
  }

  result.fontShadowIntensity = style.fontShadowIntensity ?? (shadowEnabled ? 50 : 0)
  result.fontStrokeWidth = style.fontStrokeWidth ?? (strokeEnabled ? 1 : 0)

  return result
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
        main: migrateTextStyle(oldStyle.main),
        translation: migrateTextStyle(oldStyle.translation),
      },
    },
  }
}
