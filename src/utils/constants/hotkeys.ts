export const HOTKEYS = ['control', 'alt', 'shift', 'backtick', 'clickAndHold'] as const

export const HOTKEY_ICONS: Record<typeof HOTKEYS[number], string> = {
  control: '⌃',
  alt: '⌥',
  shift: '⇧',
  backtick: '`',
  clickAndHold: '⏱',
}

// Maps to actual keyboard event key (for keydown/keyup detection)
export const HOTKEY_EVENT_KEYS: Record<typeof HOTKEYS[number], string> = {
  control: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  backtick: '`',
  clickAndHold: 'ClickAndHold', // Special handling, not a keyboard event
}
