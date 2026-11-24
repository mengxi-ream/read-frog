/**
 * Migration script from v129 to v130
 * - Adds the switches simple mode turns features off with, all on, so nothing
 *   changes until the user turns one off:
 *   - `pageTranslation.enabled`
 *   - `videoSubtitles.enabled` (v126 removed an older field of the same name and
 *     meaning, so a config here never has one)
 *   - `translationHub.enabled`
 *   - `customActions.enabled`, a new top-level object. The actions themselves
 *     stay in `selectionToolbar.customActions`.
 *
 * Idempotent: a switch already stored is kept, and a config with nothing to add
 * is returned by identity. A missing or malformed section is left for the
 * schema parse that follows.
 *
 * IMPORTANT: The values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const SECTIONS = ["pageTranslation", "videoSubtitles", "translationHub"]

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isPlainObject(oldConfig)) {
    return oldConfig
  }

  const additions: Record<string, unknown> = {}
  for (const key of SECTIONS) {
    const section = oldConfig[key]
    if (isPlainObject(section) && typeof section.enabled !== "boolean") {
      additions[key] = { ...section, enabled: true }
    }
  }

  const customActions = oldConfig.customActions
  if (!isPlainObject(customActions)) {
    additions.customActions = { enabled: true }
  } else if (typeof customActions.enabled !== "boolean") {
    additions.customActions = { ...customActions, enabled: true }
  }

  if (Object.keys(additions).length === 0) {
    return oldConfig
  }
  return { ...oldConfig, ...additions }
}
