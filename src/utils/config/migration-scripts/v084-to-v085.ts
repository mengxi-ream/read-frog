/**
 * Migration script from v084 to v085
 * - Adds the `siteRules` field (per-site translation rules): user-defined rules
 *   plus a disable list for the built-in rules shipped with the extension.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  return {
    ...oldConfig,
    siteRules: oldConfig.siteRules ?? {
      userRules: [],
      disabledBuiltInRules: [],
    },
  }
}
