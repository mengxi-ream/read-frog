/**
 * Migration script from v083 to v084
 * - Adds the `uiLanguage` field (interface language), defaulting to "auto"
 *   (follow the browser UI language).
 * - Strips resolved `description` strings that older builds baked into each
 *   `providersConfig[*]` entry. Provider descriptions are now resolved at render
 *   time from the current interface language, so a persisted (frozen-language)
 *   description would otherwise show stale text after a language switch.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function stripDescription(provider: any): any {
  if (!provider || typeof provider !== "object") {
    return provider
  }
  if (!("description" in provider)) {
    return provider
  }
  const { description: _description, ...rest } = provider
  return rest
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  const providersConfig = Array.isArray(oldConfig.providersConfig)
    ? oldConfig.providersConfig.map(stripDescription)
    : oldConfig.providersConfig

  return {
    ...oldConfig,
    providersConfig,
    uiLanguage: oldConfig.uiLanguage ?? "auto",
  }
}
