/**
 * Migration script from v059 to v060
 * - Renames `selectionToolbar.customFeatures` to `selectionToolbar.customActions`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const selectionToolbar = oldConfig.selectionToolbar
  if (!selectionToolbar) {
    return oldConfig
  }

  const { customFeatures: _customFeatures, ...restSelectionToolbar } = selectionToolbar

  if (Array.isArray(selectionToolbar.customActions)) {
    return {
      ...oldConfig,
      selectionToolbar: {
        ...restSelectionToolbar,
        customActions: selectionToolbar.customActions,
      },
    }
  }

  const customActions = Array.isArray(selectionToolbar.customFeatures)
    ? selectionToolbar.customFeatures
    : []

  return {
    ...oldConfig,
    selectionToolbar: {
      ...restSelectionToolbar,
      customActions,
    },
  }
}
