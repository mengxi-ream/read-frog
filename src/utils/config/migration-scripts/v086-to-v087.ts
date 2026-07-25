/**
 * Migration script from v086 to v087
 * - Splits site-rule force selectors into independent DOM-node and translated-style axes.
 *
 * IMPORTANT: All field names and mappings are hardcoded inline. Migration scripts are
 * frozen snapshots - never import constants, helpers, or shared types that may change.
 */

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function copyLegacyField(
  oldRule: Record<string, any>,
  migratedRule: Record<string, any>,
  oldKey: string,
  newKeys: string[],
): void {
  if (hasOwn(oldRule, oldKey)) {
    for (const newKey of newKeys) {
      // A user may already have authored a v087 field before migration. Resolve
      // conflicts per corresponding key so the explicit new value always wins.
      if (!hasOwn(oldRule, newKey)) {
        migratedRule[newKey] = oldRule[oldKey]
      }
    }
  }

  delete migratedRule[oldKey]
}

function migrateSiteRule(oldRule: any): any {
  if (!oldRule || typeof oldRule !== "object" || Array.isArray(oldRule)) {
    return oldRule
  }

  const migratedRule = { ...oldRule }

  copyLegacyField(oldRule, migratedRule, "forceBlockSelectors", [
    "forceBlockNodeSelectors",
    "forceBlockStyleSelectors",
  ])
  copyLegacyField(oldRule, migratedRule, "forceBlockSelectors.add", [
    "forceBlockNodeSelectors.add",
    "forceBlockStyleSelectors.add",
  ])
  copyLegacyField(oldRule, migratedRule, "forceBlockSelectors.remove", [
    "forceBlockNodeSelectors.remove",
    "forceBlockStyleSelectors.remove",
  ])

  copyLegacyField(oldRule, migratedRule, "forceInlineSelectors", ["forceInlineStyleSelectors"])
  copyLegacyField(oldRule, migratedRule, "forceInlineSelectors.add", [
    "forceInlineStyleSelectors.add",
  ])
  copyLegacyField(oldRule, migratedRule, "forceInlineSelectors.remove", [
    "forceInlineStyleSelectors.remove",
  ])

  return migratedRule
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  const oldSiteRules = oldConfig.siteRules
  if (
    !oldSiteRules ||
    typeof oldSiteRules !== "object" ||
    Array.isArray(oldSiteRules) ||
    !Array.isArray(oldSiteRules.userRules)
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    siteRules: {
      ...oldSiteRules,
      userRules: oldSiteRules.userRules.map(migrateSiteRule),
    },
  }
}
