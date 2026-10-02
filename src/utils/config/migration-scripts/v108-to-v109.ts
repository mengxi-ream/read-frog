/**
 * Migration script from v108 to v109
 * - Adds `pageTranslation.page.translateTitle`, the switch for translating the
 *   browser tab title along with the page. Existing configs get `true`: page
 *   translation has always translated the tab title.
 *
 * Idempotent: a config that already has the switch keeps its value and is
 * returned by identity.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  if (
    !oldConfig ||
    typeof oldConfig !== "object" ||
    Array.isArray(oldConfig) ||
    !oldConfig.pageTranslation ||
    typeof oldConfig.pageTranslation !== "object" ||
    Array.isArray(oldConfig.pageTranslation) ||
    !oldConfig.pageTranslation.page ||
    typeof oldConfig.pageTranslation.page !== "object" ||
    Array.isArray(oldConfig.pageTranslation.page)
  ) {
    return oldConfig
  }

  if (typeof oldConfig.pageTranslation.page.translateTitle === "boolean") {
    return oldConfig
  }

  return {
    ...oldConfig,
    pageTranslation: {
      ...oldConfig.pageTranslation,
      page: {
        ...oldConfig.pageTranslation.page,
        translateTitle: true,
      },
    },
  }
}
