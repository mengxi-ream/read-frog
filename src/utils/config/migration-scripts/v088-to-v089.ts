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

function getMigratedCohereModel(modelConfig: any): string | null {
  const selectedModel = typeof modelConfig?.model === "string" ? modelConfig.model.trim() : null
  if (selectedModel && DEPRECATED_TO_LIVE_COHERE_MODEL[selectedModel]) {
    return DEPRECATED_TO_LIVE_COHERE_MODEL[selectedModel]
  }

  if (modelConfig?.isCustomModel === true) {
    const customModel =
      typeof modelConfig?.customModel === "string" ? modelConfig.customModel.trim() : null
    if (customModel && DEPRECATED_TO_LIVE_COHERE_MODEL[customModel]) {
      return DEPRECATED_TO_LIVE_COHERE_MODEL[customModel]
    }
  }

  return null
}

function migrateProviderConfig(providerConfig: any): any {
  if (!providerConfig || typeof providerConfig !== "object") {
    return providerConfig
  }

  const modelConfig = providerConfig.model
  if (providerConfig.provider !== "cohere" || !modelConfig || typeof modelConfig !== "object") {
    return providerConfig
  }

  const migratedModel = getMigratedCohereModel(modelConfig)
  if (migratedModel === null) {
    return providerConfig
  }

  return {
    ...providerConfig,
    model: {
      ...modelConfig,
      model: migratedModel,
      isCustomModel: false,
      customModel: null,
    },
  }
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: oldConfig.providersConfig.map(migrateProviderConfig),
  }
}
