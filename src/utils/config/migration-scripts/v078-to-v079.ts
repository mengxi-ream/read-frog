/**
 * Migration script from v078 to v079
 * - Adds `translate.page.sidePanelShortcut` with a default value of `"Alt+C"`.
 * - Adds `translate.translationHub.selectedProviderIds` with Microsoft as the default provider.
 *
 * IMPORTANT: Migration scripts are frozen snapshots - never import constants
 * or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  if (!oldConfig?.translate)
    return oldConfig

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      translationHub: {
        ...oldConfig.translate.translationHub,
        selectedProviderIds: Array.isArray(oldConfig.translate.translationHub?.selectedProviderIds)
          ? oldConfig.translate.translationHub.selectedProviderIds
          : ["microsoft-translate-default"],
      },
      page: {
        ...oldConfig.translate.page,
        sidePanelShortcut: oldConfig.translate.page?.sidePanelShortcut ?? "Alt+C",
      },
    },
  }
}
