/**
 * Migration script from v073 to v074
 * - Adds neverAutoTranslatePatterns to page translation config.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      page: {
        ...oldConfig?.translate?.page,
        neverAutoTranslatePatterns: Array.isArray(oldConfig?.translate?.page?.neverAutoTranslatePatterns)
          ? oldConfig.translate.page.neverAutoTranslatePatterns
          : [],
      },
    },
  }
}
