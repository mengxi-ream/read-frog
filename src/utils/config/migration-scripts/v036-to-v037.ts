/**
 * Migration script from v036 to v037
 * Removes 'detectedCode' from language config as it's now stored separately
 *
 * Before (v036):
 *   { language: { detectedCode, sourceCode, targetCode, level }, ... }
 *
 * After (v037):
 *   { language: { sourceCode, targetCode, level }, ... }
 */

export function migrate(oldConfig: any): any {
  const { detectedCode: _, ...restLanguage } = oldConfig.language ?? {}

  return {
    ...oldConfig,
    language: restLanguage,
  }
}
