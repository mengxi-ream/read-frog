/**
 * Migration script from v088 to v089
 * - Removes deprecated Cohere Command models from the hardcoded model list
 *   and remaps any saved provider configs that use them to the closest
 *   currently-live Cohere model.
 * - When custom model mode is active, remaps only the dormant selector-backed
 *   `model` field so schema validation still passes, while preserving
 *   `isCustomModel` and `customModel`.
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

function getNormalizedModelId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const model = value.trim()
  return model || null
}

function migrateProviderConfig(providerConfig: any): any {
  if (!providerConfig || typeof providerConfig !== "object") {
    return providerConfig
  }

  const modelConfig = providerConfig.model
  if (providerConfig.provider !== "cohere" || !modelConfig || typeof modelConfig !== "object") {
    return providerConfig
  }

  // `model` is always schema-validated against the live enum, even when custom
  // mode is active. Remap a deprecated dormant selector so validation passes.
  const selectedModel = getNormalizedModelId(modelConfig.model)
  const migratedModel =
    selectedModel === null ? null : (DEPRECATED_TO_LIVE_COHERE_MODEL[selectedModel] ?? null)

  if (migratedModel === null) {
    return providerConfig
  }

  // Preserve an active custom model selection. Only the dormant selector needs
  // to become a valid enum value for post-migration schema validation.
  if (modelConfig.isCustomModel === true) {
    return {
      ...providerConfig,
      model: {
        ...modelConfig,
        model: migratedModel,
      },
    }
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
