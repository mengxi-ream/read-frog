/**
 * Migration script from v077 to v078
 * - Adds selectionToolbar.features.translate.shortcut.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig?.selectionToolbar,
      features: {
        ...oldConfig?.selectionToolbar?.features,
        translate: {
          ...oldConfig?.selectionToolbar?.features?.translate,
          shortcut: "Alt+T",
        },
      },
    },
  }
}
