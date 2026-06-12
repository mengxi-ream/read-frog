/**
 * Migration script from v079 to v080
 * - Adds `translate.page.splitPanelMode` with a default value of `"dom"`.
 *
 * IMPORTANT: Migration scripts are frozen snapshots - never import constants
 * or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  if (!oldConfig?.translate)
    return oldConfig

  const existingMode = oldConfig.translate.page?.splitPanelMode

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      page: {
        ...oldConfig.translate.page,
        splitPanelMode: existingMode === "sideAPI" ? "sideAPI" : "dom",
      },
    },
  }
}
