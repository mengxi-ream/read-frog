/**
 * Migration script from v118 to v119
 * - Adds `selectionToolbar.annotation.modeShortcut` ("Alt+Shift+P"), the key
 *   that turns annotation mode on and off from the page, so the reader no
 *   longer has to open the selection toolbar for its switch.
 * - A key the reader already gave another shortcut is not taken from it: the
 *   new one starts empty instead.
 *
 * Idempotent: a mode key already present keeps its value, and a config with
 * nothing to add is returned by identity. Malformed shapes are left for the
 * schema parse that follows.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const MODE_SHORTCUT = "Alt+Shift+P"

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

// A shortcut as the keys it presses, however it is written: "Shift+Alt+p"
// and "Alt+Shift+P" give the same. Modifiers are sorted and their aliases
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

// The keys the reader's existing shortcuts press, as of v118.
function collectTakenKeys(config: Record<string, any>): Set<string> {
  const pageTranslation = config.pageTranslation
  const selectionToolbar = config.selectionToolbar
  const builtInActions = isRecord(selectionToolbar?.builtInActions)
    ? Object.values(selectionToolbar.builtInActions)
    : []
  const customActions = Array.isArray(selectionToolbar?.customActions)
    ? selectionToolbar.customActions
    : []
  const shortcuts = [
    pageTranslation?.page?.shortcut,
    pageTranslation?.modeShortcut,
    // Hover translation listens for its key only while it uses a custom one.
    pageTranslation?.node?.hotkey === "custom" ? pageTranslation.node.shortcut : undefined,
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
  if (!isRecord(oldConfig) || !isRecord(oldConfig.selectionToolbar)) {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  const annotation = selectionToolbar.annotation
  if (!isRecord(annotation) || typeof annotation.modeShortcut === "string") {
    return oldConfig
  }

  const taken = collectTakenKeys(oldConfig).has(toKey(MODE_SHORTCUT)!)

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      annotation: { ...annotation, modeShortcut: taken ? "" : MODE_SHORTCUT },
    },
  }
}
