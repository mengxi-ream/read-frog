/**
 * Migration script from v041 to v042
 * Adds 'minWordsPerNode' to page translation config
 *
 * Before (v041):
 *   { ..., translate: { page: { ..., minCharactersPerNode: 0 } } }
 *
 * After (v042):
 *   { ..., translate: { page: { ..., minCharactersPerNode: 0, minWordsPerNode: 0 } } }
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      page: {
        ...oldConfig.translate?.page,
        minWordsPerNode: 0,
      },
    },
  }
}
