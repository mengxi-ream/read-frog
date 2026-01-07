/**
 * Migration script from v039 to v040
 * Adds 'inputTranslation' config for triple-space input translation feature
 *
 * Before (v039):
 *   { ... }
 *
 * After (v040):
 *   { ..., inputTranslation: { enabled: true, direction: 'normal', useCustomTarget: true, targetCode: 'eng', timeThreshold: 300 } }
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    inputTranslation: {
      enabled: true,
      direction: 'normal',
      useCustomTarget: true,
      targetCode: 'eng',
      timeThreshold: 300,
    },
  }
}
