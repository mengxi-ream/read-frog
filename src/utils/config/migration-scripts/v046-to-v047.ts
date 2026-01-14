/**
 * Migration script from v046 to v047
 * Adds siteControl config for whitelist mode feature
 *
 * Before (v046):
 *   { ... } (no siteControl field)
 *
 * After (v047):
 *   { ..., siteControl: { mode: 'all', patterns: [] } }
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    siteControl: {
      mode: 'all',
      patterns: [],
    },
  }
}
