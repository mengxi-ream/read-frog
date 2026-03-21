/**
 * Migration script from v066 to v067
 * - Adds `translationHubConfig` to `translate`
 * - Adds `selectedIds` to `translationHubConfig`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const translate = oldConfig.translate

  if (!translate) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: {
      ...translate,
      translationHubConfig: {
        selectedIds: [],
      },
    },
  }
}
