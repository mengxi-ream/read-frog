/**
 * Migration script from v042 to v043
 * Adds 'minWordsPerNode' to page translation config
 *
 * Before (v042):
 *   { ..., translate: { page: { ..., minCharactersPerNode: 0 } } }
 *
 * After (v043):
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
