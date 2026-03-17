/**
 * Migration script from v064 to v065
 * - Adds `opacity` to `selectionToolbar`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const selectionToolbar = oldConfig.selectionToolbar

  if (!selectionToolbar) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      opacity: 100,
    },
  }
}
