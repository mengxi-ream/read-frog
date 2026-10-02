/**
 * Frozen v109 snapshot: title translation becomes an independent page preference.
 * Keep the existing behavior on upgrade and preserve an explicit opt-out on reruns.
 */
export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    pageTranslation: {
      ...oldConfig.pageTranslation,
      page: {
        ...oldConfig.pageTranslation.page,
        translateTitle: oldConfig.pageTranslation.page.translateTitle ?? true,
      },
    },
  }
}
