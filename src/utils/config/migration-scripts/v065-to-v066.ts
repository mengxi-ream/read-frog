/**
 * Migration script from v065 to v066
 * - Adds `anchor` to `floatingButton`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig: any): any {
  const floatingButton = oldConfig.floatingButton

  if (!floatingButton) {
    return oldConfig
  }

  if (floatingButton.anchor === "left" || floatingButton.anchor === "right") {
    return oldConfig
  }

  return {
    ...oldConfig,
    floatingButton: {
      ...floatingButton,
      anchor: "right",
    },
  }
}
