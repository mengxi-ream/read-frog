/**
 * Migration script from v088 to v089
 * - Adds `toggleShortcut` to the video subtitles config, defaulting to "Alt+C".
 * - Falls back to "Alt+Shift+C" when the user already bound "Alt+C" to another
 *   shortcut, and leaves it unbound when both candidates are taken. The fallback
 *   key deliberately exists nowhere else in the codebase: it only ever applies to
 *   configs that predate this field.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const PRIMARY_SHORTCUT = "Alt+C"
const FALLBACK_SHORTCUT = "Alt+Shift+C"

/**
 * Shortcuts are stored already normalized (fixed modifier order, canonical key
 * name), so comparing the lowercased strings is enough to spot a collision.
 */
function collectBoundShortcuts(oldConfig: any): Set<string> {
  const bound = new Set<string>()
  const candidates = [
    oldConfig?.translate?.page?.shortcut,
    oldConfig?.translate?.modeShortcut,
    oldConfig?.selectionToolbar?.features?.translate?.shortcut,
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue
    }

    const trimmed = candidate.trim()
    if (trimmed) {
      bound.add(trimmed.toLowerCase())
    }
  }

  return bound
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  const videoSubtitles = oldConfig.videoSubtitles
  if (!videoSubtitles || typeof videoSubtitles !== "object" || Array.isArray(videoSubtitles)) {
    return oldConfig
  }

  if ("toggleShortcut" in videoSubtitles) {
    return oldConfig
  }

  const boundShortcuts = collectBoundShortcuts(oldConfig)
  const toggleShortcut = !boundShortcuts.has(PRIMARY_SHORTCUT.toLowerCase())
    ? PRIMARY_SHORTCUT
    : !boundShortcuts.has(FALLBACK_SHORTCUT.toLowerCase())
      ? FALLBACK_SHORTCUT
      : ""

  return {
    ...oldConfig,
    videoSubtitles: {
      ...videoSubtitles,
      toggleShortcut,
    },
  }
}
