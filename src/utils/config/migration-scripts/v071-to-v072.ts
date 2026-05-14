/**
 * Migration script from v071 to v072
 * - Adds translate.page.enableTargetLanguageSkip.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig?.translate,
      page: {
        ...oldConfig?.translate?.page,
        enableTargetLanguageSkip: true,
      },
    },
  }
}
