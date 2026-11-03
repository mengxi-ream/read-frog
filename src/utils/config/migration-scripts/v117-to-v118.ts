/**
 * Migration script from v117 to v118
 * - Adds `difficultWords`, marking the words on a page the reader probably
 *   does not know: on, with the key Alt+Shift+V, a click on a marked word
 *   running the built-in Dictionary.
 * - A reader who already gave Alt+Shift+V to another shortcut keeps it there:
 *   the new shortcut starts empty instead.
 * - Removes `language.level`. Nothing read it; the level is now asked per
 *   language the first time words are marked in it, and kept on the server.
 *
 * Idempotent: a config with nothing to change is returned by identity.
 *
 * IMPORTANT: The defaults are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const DIFFICULT_WORDS_SHORTCUT = "Alt+Shift+V"
const DICTIONARY_ACTION_ID = "default-dictionary"

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

const MODIFIER_ALIASES: Record<string, string> = {
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
  control: "control",
  ctrl: "control",
  meta: "meta",
  cmd: "meta",
  command: "meta",
  mod: "mod",
}

// A shortcut as the keys it presses, however it is written: "Shift+Alt+v"
// and "Alt+Shift+V" give the same. Modifiers are sorted and their aliases
// folded; the last part is the key ("Alt++" is the "+" key).
function toKey(shortcut: unknown): string | null {
  if (typeof shortcut !== "string") {
    return null
  }
  let text = shortcut.trim().toLowerCase()
  if (text === "") {
    return null
  }

  let key: string
  if (text.endsWith("++")) {
    key = "+"
    text = text.slice(0, -2)
  } else {
    const lastPlus = text.lastIndexOf("+")
    key = text.slice(lastPlus + 1).trim()
    text = lastPlus === -1 ? "" : text.slice(0, lastPlus)
  }

  const modifiers = text
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => MODIFIER_ALIASES[part] ?? part)
  return [...[...new Set(modifiers)].sort(), key].join("+")
}

// The keys the reader's shortcuts press. A missing shortcut (speak's,
// annotation's, a built-in action's) means its default key, none of which is
// Alt+Shift+V, so only the ones written down count.
function collectTakenKeys(config: Record<string, any>): Set<string> {
  const selectionToolbar = config.selectionToolbar
  const builtInActions = isRecord(selectionToolbar?.builtInActions)
    ? Object.values(selectionToolbar.builtInActions)
    : []
  const customActions = Array.isArray(selectionToolbar?.customActions)
    ? selectionToolbar.customActions
    : []
  const node = config.pageTranslation?.node
  const shortcuts = [
    config.pageTranslation?.page?.shortcut,
    config.pageTranslation?.modeShortcut,
    isRecord(node) && node.hotkey === "custom" ? node.shortcut : undefined,
    selectionToolbar?.features?.translate?.shortcut,
    selectionToolbar?.features?.speak?.shortcut,
    selectionToolbar?.annotation?.shortcut,
    config.videoSubtitles?.toggleShortcut,
    config.translationHub?.shortcut,
    ...builtInActions.map((state: any) => (isRecord(state) ? state.shortcut : undefined)),
    ...customActions.map((action: any) => (isRecord(action) ? action.shortcut : undefined)),
  ]
  return new Set(shortcuts.map(toKey).filter((key): key is string => key !== null))
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig)) {
    return oldConfig
  }

  let config = oldConfig

  if (isRecord(config.language) && "level" in config.language) {
    const { level: _level, ...language } = config.language
    config = { ...config, language }
  }

  // A UI context that parsed this config before the migration ran may have
  // written the field back without a key; it still gets one here.
  const current = isRecord(config.difficultWords) ? config.difficultWords : null
  const needsShortcut = typeof current?.shortcut !== "string"
  const needsAction = typeof current?.lookupActionId !== "string"
  if (current === null || needsShortcut || needsAction) {
    const shortcut = collectTakenKeys(config).has(toKey(DIFFICULT_WORDS_SHORTCUT)!)
      ? ""
      : DIFFICULT_WORDS_SHORTCUT
    config = {
      ...config,
      difficultWords: {
        enabled: typeof current?.enabled === "boolean" ? current.enabled : true,
        shortcut: needsShortcut ? shortcut : current?.shortcut,
        lookupActionId: needsAction ? DICTIONARY_ACTION_ID : current?.lookupActionId,
      },
    }
  }

  return config
}
