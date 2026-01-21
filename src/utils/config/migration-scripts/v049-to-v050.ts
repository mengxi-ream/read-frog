/**
 * Migration script from v049 to v050
 * Adds 'skipLanguages' and 'enableSkipLanguagesLLMDetection' to translate.page config
 *
 * Before (v049):
 *   { ..., translate: { page: { ... } } }
 *
 * After (v050):
 *   { ..., translate: { page: { ..., skipLanguages: [], enableSkipLanguagesLLMDetection: false } } }
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      page: {
        ...oldConfig.translate.page,
        skipLanguages: [],
        enableSkipLanguagesLLMDetection: false,
      },
    },
  }
}
