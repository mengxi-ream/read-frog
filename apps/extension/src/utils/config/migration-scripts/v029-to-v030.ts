/**
 * Migration script from v029 to v030
 * Restructures translationNodeStyle from simple string to object with custom CSS support
 *
 * Before (v029):
 *   translationNodeStyle: 'default' | 'blur' | 'custom' | ...
 *
 * After (v030):
 *   translationNodeStyle: {
 *     preset: 'default' | 'blur' | ...  (excludes 'custom')
 *     isCustom: boolean
 *     customCSS: string
 *   }
 */

export function migrate(oldConfig: any): any {
  const oldStyle = oldConfig.translate?.translationNodeStyle ?? 'default'

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      translationNodeStyle: {
        preset: oldStyle,
        isCustom: false,
        customCSS: null,
      },
    },
  }
}
