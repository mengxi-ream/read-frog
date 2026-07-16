/**
 * Migration script from v085 to v086
 * - Adds `selectionToolbar.saveSuggestion` ({ enabled: true }): the "guess you
 *   want to save" card shown in the selection translation popover.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig.selectionToolbar,
      saveSuggestion: oldConfig.selectionToolbar?.saveSuggestion ?? { enabled: true },
    },
  }
}
