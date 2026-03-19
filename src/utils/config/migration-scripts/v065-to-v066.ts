/**
 * Migration script from v065 to v066
 * - Removes the deprecated selectionToolbar.features.vocabularyInsight config
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const oldSelectionToolbar = oldConfig?.selectionToolbar ?? {}
  const oldFeatures = oldSelectionToolbar?.features ?? {}
  const { vocabularyInsight: _removedVocabularyInsight, ...features } = oldFeatures

  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldSelectionToolbar,
      features,
    },
  }
}
