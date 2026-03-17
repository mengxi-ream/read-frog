/**
 * Migration script from v062 to v063
 * - Adds `enabled: true` to selectionToolbar.features.translate
 * - Adds `enabled: true` to selectionToolbar.features.vocabularyInsight
 * - Adds new `speak: { enabled: true }` to selectionToolbar.features
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const oldFeatures = oldConfig?.selectionToolbar?.features ?? {}

  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig?.selectionToolbar,
      features: {
        translate: {
          ...oldFeatures.translate,
          enabled: true,
        },
        speak: {
          enabled: true,
        },
        vocabularyInsight: {
          ...oldFeatures.vocabularyInsight,
          enabled: true,
        },
      },
    },
  }
}
