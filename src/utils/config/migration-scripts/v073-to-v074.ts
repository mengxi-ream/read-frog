/**
 * Migration script from v073 to v074
 * - Adds `translationHub.selectedProviderIds` (defaulting to `null`) so the
 *   Translation Hub can remember the user's chosen translation services.
 *   `null` means "no explicit selection yet" → fall back to all enabled
 *   translate providers.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    translationHub: {
      ...oldConfig?.translationHub,
      selectedProviderIds: oldConfig?.translationHub?.selectedProviderIds ?? null,
    },
  }
}
