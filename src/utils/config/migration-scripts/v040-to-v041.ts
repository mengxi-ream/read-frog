/**
 * Migration script from v040 to v041
 * Adds 'minCharactersPerNode' to page translation config
 *
 * Before (v040):
 *   { ..., translate: { page: { ... } } }
 *
 * After (v041):
 *   { ..., translate: { page: { ..., minCharactersPerNode: 0 } } }
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      page: {
        ...oldConfig.translate?.page,
        minCharactersPerNode: 0,
      },
    },
  }
}
