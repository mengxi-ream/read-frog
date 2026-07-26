/**
 * Migration script from v087 to v088
 * - Adds `pdfTranslation` config section with `enabled: false` default.
 *
 * IMPORTANT: All field names and mappings are hardcoded inline. Migration scripts are
 * frozen snapshots - never import constants, helpers, or shared types that may change.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  if (oldConfig.pdfTranslation !== undefined) {
    return oldConfig
  }

  return {
    ...oldConfig,
    pdfTranslation: {
      enabled: false,
    },
  }
}
