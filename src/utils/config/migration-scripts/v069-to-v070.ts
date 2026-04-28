/**
 * Migration script from v069 to v070
 * - Adds `translate.splitTranslator.shortcut` with a default value of `"Alt+S"`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      splitTranslator: {
        shortcut: oldConfig?.translate?.splitTranslator?.shortcut ?? "Alt+S",
      },
    },
  }
}
