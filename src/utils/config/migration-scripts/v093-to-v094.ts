/**
 * Migration script from v093 to v094
 * - Adds the `translationHub` config with a `shortcut` that opens the
 *   Translation Hub page, defaulting to "Alt+Shift+H".
 * - Falls back to "Alt+Shift+U" when the user already bound "Alt+Shift+H" to
 *   another shortcut, and leaves it unbound when both candidates are taken.
 *   The fallback key deliberately exists nowhere else in the codebase: it only
 *   ever applies to configs that predate this field.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const PRIMARY_SHORTCUT = "Alt+Shift+H"
const FALLBACK_SHORTCUT = "Alt+Shift+U"

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
    oldConfig?.videoSubtitles?.toggleShortcut,
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
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  if ("translationHub" in oldConfig) {
    return oldConfig
  }

  const boundShortcuts = collectBoundShortcuts(oldConfig)
  const shortcut = !boundShortcuts.has(PRIMARY_SHORTCUT.toLowerCase())
    ? PRIMARY_SHORTCUT
    : !boundShortcuts.has(FALLBACK_SHORTCUT.toLowerCase())
      ? FALLBACK_SHORTCUT
      : ""

  return {
    ...oldConfig,
    translationHub: {
      shortcut,
    },
  }
}
