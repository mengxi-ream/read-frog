/**
 * Migration script from v109 to v110
 * - Adds `selectionToolbar.features.speak.shortcut` ("Alt+Shift+R") and a
 *   `shortcut` to each built-in action's state in
 *   `selectionToolbar.builtInActions`: dictionary "Alt+Shift+D", sentence
 *   analysis "Alt+Shift+G", improve writing "Alt+Shift+W".
 * - A key the reader already gave another shortcut (page translation,
 *   translation mode, selection translation, subtitles, Translation Hub) is
 *   not taken from it: the new shortcut starts empty instead.
 * - Custom actions get no field: a custom action without one has no key.
 *
 * Idempotent: a shortcut already present keeps its value, and a config with
 * nothing to add is returned by identity.
 *
 * IMPORTANT: The defaults are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const SPEAK_SHORTCUT = "Alt+Shift+R"

const BUILT_IN_ACTION_SHORTCUTS: [key: string, shortcut: string][] = [
  ["dictionary", "Alt+Shift+D"],
  ["sentenceAnalysis", "Alt+Shift+G"],
  ["improveWriting", "Alt+Shift+W"],
]

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function toKey(shortcut: unknown): string | null {
  if (typeof shortcut !== "string") {
    return null
  }
  const key = shortcut.trim().toLowerCase()
  return key === "" ? null : key
}

// The keys the reader's existing shortcuts hold, as stored.
function collectTakenKeys(config: Record<string, any>): Set<string> {
  const shortcuts = [
    config.pageTranslation?.page?.shortcut,
    config.pageTranslation?.modeShortcut,
    config.selectionToolbar?.features?.translate?.shortcut,
    config.videoSubtitles?.toggleShortcut,
    config.translationHub?.shortcut,
  ]
  return new Set(shortcuts.map(toKey).filter((key): key is string => key !== null))
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig) || !isRecord(oldConfig.selectionToolbar)) {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  const takenKeys = collectTakenKeys(oldConfig)
  const claim = (shortcut: string) => {
    const key = shortcut.toLowerCase()
    if (takenKeys.has(key)) {
      return ""
    }
    takenKeys.add(key)
    return shortcut
  }

  let changed = false
  let features = selectionToolbar.features
  if (
    isRecord(features) &&
    isRecord(features.speak) &&
    typeof features.speak.shortcut !== "string"
  ) {
    features = {
      ...features,
      speak: { ...features.speak, shortcut: claim(SPEAK_SHORTCUT) },
    }
    changed = true
  }

  let builtInActions = selectionToolbar.builtInActions
  if (isRecord(builtInActions)) {
    for (const [key, shortcut] of BUILT_IN_ACTION_SHORTCUTS) {
      const state = builtInActions[key]
      if (!isRecord(state) || typeof state.shortcut === "string") {
        continue
      }
      builtInActions = {
        ...builtInActions,
        [key]: { ...state, shortcut: claim(shortcut) },
      }
      changed = true
    }
  }

  if (!changed) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      features,
      builtInActions,
    },
  }
}
