/**
 * Migration script from v099 to v100.
 *
 * Gives `videoSubtitles.style` a `customCSS` slot, holding extra CSS for the two subtitle lines on
 * top of the fonts, sizes and colours the style editor already sets. `null` means no custom CSS,
 * which is what every existing profile gets here.
 *
 * The field is nested rather than top-level, so a schema default cannot stand in for this step:
 * `migrateConfig` only reaches for defaults on whole sections, and a stored v099 config would
 * otherwise fail `configSchema` outright and be replaced by DEFAULT_CONFIG — losing the user's
 * providers along with their subtitle styling.
 *
 * Idempotent: a config that already carries the key is returned by identity, as is one whose
 * `videoSubtitles.style` is missing or not an object (the schema parse that follows will report
 * that far better than a migration guessing at a repair).
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const videoSubtitles = oldConfig.videoSubtitles
  if (!isObject(videoSubtitles)) {
    return oldConfig
  }

  const style = videoSubtitles.style
  if (!isObject(style) || "customCSS" in style) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: {
      ...videoSubtitles,
      style: {
        ...style,
        customCSS: null,
      },
    },
  }
}
