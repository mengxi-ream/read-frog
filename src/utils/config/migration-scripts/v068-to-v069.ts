/**
 * Migration script from v068 to v069
 * - Adds `floatingButton.side` with a default value of `"right"`
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  return {
    ...oldConfig,
    floatingButton: {
      ...oldConfig?.floatingButton,
      side: oldConfig?.floatingButton?.side ?? "right",
    },
  }
}
