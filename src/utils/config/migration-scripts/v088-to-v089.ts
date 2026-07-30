/**
 * Migration script from v088 to v089
 * - Adds persisted Translation Hub provider selection.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translationHub: oldConfig.translationHub ?? {
      selectedProviderIds: null,
    },
  }
}
