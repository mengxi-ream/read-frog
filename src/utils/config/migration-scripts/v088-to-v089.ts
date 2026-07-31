/**
 * Migration script from v088 to v089
 * - Removes deprecated Cohere Command models from the hardcoded model list
 *   and remaps any saved provider configs that use them to the closest
 *   currently-live Cohere model.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

const DEPRECATED_TO_LIVE_COHERE_MODEL: Record<string, string> = {
  "command-r-03-2024": "command-r-08-2024",
  "command-r": "command-r-08-2024",
  "command-r-plus-04-2024": "command-r-plus-08-2024",
  "command-r-plus": "command-r-plus-08-2024",
  command: "command-r7b-12-2024",
  "command-nightly": "command-r7b-12-2024",
  "command-light": "command-r7b-12-2024",
  "command-light-nightly": "command-r7b-12-2024",
}

function migrateCohereProvider(provider: any): any {
  if (!provider || typeof provider !== "object" || provider.provider !== "cohere") {
    return provider
  }

  const model = provider.model
  if (!model || typeof model !== "object" || model.isCustomModel !== false) {
    return provider
  }

  const currentModel = model.model
  if (typeof currentModel !== "string" || !(currentModel in DEPRECATED_TO_LIVE_COHERE_MODEL)) {
    return provider
  }

  return {
    ...provider,
    model: {
      ...model,
      model: DEPRECATED_TO_LIVE_COHERE_MODEL[currentModel],
    },
  }
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  const providersConfig = Array.isArray(oldConfig.providersConfig)
    ? oldConfig.providersConfig.map(migrateCohereProvider)
    : oldConfig.providersConfig

  return {
    ...oldConfig,
    providersConfig,
  }
}
