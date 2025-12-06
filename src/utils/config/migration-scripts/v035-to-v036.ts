/**
 * Migration script from v035 to v036
 * Adds 'preload' config to translate.page for controlling
 * pre-translation of content below the viewport
 *
 * Before (v035):
 *   { translate: { page: { range, autoTranslatePatterns, ... } }, ... }
 *
 * After (v036):
 *   { translate: { page: { ..., preload: { margin: 1000, threshold: 0 } } }, ... }
 */

import { DEFAULT_PRELOAD_MARGIN, DEFAULT_PRELOAD_THRESHOLD } from '@/utils/constants/translate'

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      page: {
        ...oldConfig.translate?.page,
        preload: {
          margin: DEFAULT_PRELOAD_MARGIN,
          threshold: DEFAULT_PRELOAD_THRESHOLD,
        },
      },
    },
  }
}
