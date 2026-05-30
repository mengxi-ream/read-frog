/**
 * Migration script from v073 to v074
 * - Adds holdTriggerMs: 500 to translate.node
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig?.translate?.node) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: {
      ...oldConfig.translate,
      node: {
        holdTriggerMs: 500,
        ...oldConfig.translate.node,
      },
    },
  }
}
