export const HOTKEYS = ['Control', 'Alt', 'Shift', '`'] as const
export const HOTKEY_ITEMS: Record<typeof HOTKEYS[number], { label: string, icon: string }> = {
  'Control': { label: 'Ctrl', icon: '⌃' },
  'Alt': { label: 'Option', icon: '⌥' },
  'Shift': { label: 'Shift', icon: '⇧' },
  '`': { label: 'Backtick', icon: '`' },
}
