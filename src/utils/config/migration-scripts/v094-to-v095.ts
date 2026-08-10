/**
 * Migration script from v094 to v095.
 *
 * Renames the top-level `translate` config section to `pageTranslation`, so the
 * feature identifier matches the one the hosted AI contract uses. Only the whole
 * page translation surface moves; `selectionToolbar.features.translate` is a
 * different surface and keeps its name.
 *
 * IMPORTANT: This is a frozen snapshot. All values and helpers are deliberately inline and it
 * imports nothing from the evolving application code.
 */

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig) || !("translate" in oldConfig)) {
    return oldConfig
  }

  const { translate, ...rest } = oldConfig

  // A config that already carries the new key keeps it: the old section is
  // stale in that case, so dropping it is the correct merge.
  if ("pageTranslation" in rest) {
    return rest
  }

  return { ...rest, pageTranslation: translate }
}
