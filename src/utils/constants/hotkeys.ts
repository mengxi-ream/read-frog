/**
 * What runs hover translation on the paragraph under the pointer: a single key tapped or
 * held while hovering, a long press of the mouse, or `custom`, the key combination recorded in
 * `pageTranslation.node.shortcut`.
 */
export const HOTKEYS = ["control", "alt", "shift", "backtick", "clickAndHold", "custom"] as const
export type NodeHotkey = (typeof HOTKEYS)[number]

// The single-key hotkeys, by the `KeyboardEvent.key` each one listens for
export const HOTKEY_EVENT_KEYS = {
  control: "Control",
  alt: "Alt",
  shift: "Shift",
  backtick: "`",
} as const satisfies Partial<Record<NodeHotkey, string>>

export type SingleKeyHotkey = keyof typeof HOTKEY_EVENT_KEYS

export const HOTKEY_ICONS: Record<SingleKeyHotkey, string> = {
  control: "⌃",
  alt: "⌥",
  shift: "⇧",
  backtick: "`",
}

export function isSingleKeyHotkey(hotkey: NodeHotkey): hotkey is SingleKeyHotkey {
  return Object.hasOwn(HOTKEY_EVENT_KEYS, hotkey)
}

// The combination `custom` starts with. A bare Alt+<letter>, like the other reading shortcuts
// (page translation has E, selection translation T, subtitles C), and Q because the hand off the
// mouse reaches it and no browser keeps it: Chrome and Edge have Alt+D, E and F, and Firefox
// opens its menus with Alt and their initials (A is "Affichage" and "Ansicht").
export const DEFAULT_NODE_TRANSLATION_SHORTCUT_KEY = "Alt+Q"
