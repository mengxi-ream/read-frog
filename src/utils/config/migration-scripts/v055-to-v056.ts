/**
 * Migration script from v055 to v056
 * Adds selectionToolbar.customFeatures with default []
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig.selectionToolbar,
      customFeatures: oldConfig.selectionToolbar?.customFeatures ?? [],
    },
  }
}
