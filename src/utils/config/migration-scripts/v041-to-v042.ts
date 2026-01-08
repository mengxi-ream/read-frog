/**
 * Migration script from v041 to v042
 * Migrates hotkey values to camelCase format for i18n compatibility
 *
 * Before (v041):
 *   { ..., translate: { node: { hotkey: 'Control' } } }
 *
 * After (v042):
 *   { ..., translate: { node: { hotkey: 'control' } } }
 */

const HOTKEY_MIGRATION: Record<string, string> = {
  'Control': 'control',
  'Alt': 'alt',
  'Shift': 'shift',
  '`': 'backtick',
}

export function migrate(oldConfig: any): any {
  const oldHotkey = oldConfig.translate?.node?.hotkey
  const newHotkey = oldHotkey ? (HOTKEY_MIGRATION[oldHotkey] ?? 'control') : 'control'

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      node: {
        ...oldConfig.translate?.node,
        hotkey: newHotkey,
      },
    },
  }
}
