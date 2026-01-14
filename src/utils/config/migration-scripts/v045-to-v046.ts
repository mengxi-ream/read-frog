/**
 * Migration script from v045 to v046
 * Refactors inputTranslation config from direction-based to explicit language selectors
 *
 * Before (v045):
 *   { ..., inputTranslation: { enabled, direction, useCustomTarget, targetCode, timeThreshold } }
 *
 * After (v046):
 *   { ..., inputTranslation: { enabled, fromLang, toLang, enableCycle, timeThreshold } }
 */
export function migrate(oldConfig: any): any {
  const old = oldConfig.inputTranslation
  return {
    ...oldConfig,
    inputTranslation: {
      enabled: old.enabled,
      fromLang: 'targetCode',
      toLang: 'sourceCode',
      enableCycle: false,
      timeThreshold: old.timeThreshold,
    },
  }
}
