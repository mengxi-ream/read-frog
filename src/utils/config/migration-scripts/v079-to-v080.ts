/**
 * Migration script from v079 to v080
 * - Moves old xAI Grok selector-backed models to current Grok 4.20 0309 models.
 * - Clears custom model mode for migrated xAI entries so they use the supported selector value.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const XAI_GROK_420_0309_REASONING_MODEL = "grok-4.20-0309-reasoning"
const XAI_GROK_420_0309_NON_REASONING_MODEL = "grok-4.20-0309-non-reasoning"

const OLD_XAI_GROK_MODEL_REPLACEMENTS: Record<string, string> = {
  "grok-4.20-reasoning": XAI_GROK_420_0309_REASONING_MODEL,
  "grok-4-1-fast-reasoning": XAI_GROK_420_0309_REASONING_MODEL,
  "grok-4-fast-reasoning": XAI_GROK_420_0309_REASONING_MODEL,
  "grok-4.20-non-reasoning": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-4.20-multi-agent-0309": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-4-1": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-4-1-fast-non-reasoning": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-4-fast-non-reasoning": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-4-0709": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-4-latest": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-4": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-code-fast-1": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3-mini-fast": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3-mini-fast-latest": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3-mini-latest": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3-mini": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3-fast": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3-fast-latest": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3-latest": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-3": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-2": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-2-latest": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-2-1212": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-2-vision": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-2-vision-latest": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-2-vision-1212": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-beta": XAI_GROK_420_0309_NON_REASONING_MODEL,
  "grok-vision-beta": XAI_GROK_420_0309_NON_REASONING_MODEL,
}

function getNormalizedModelId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const model = value.trim()
  return model ? model.toLowerCase() : null
}

function getMigratedXaiModel(modelConfig: any): string | null {
  const selectedModel = getNormalizedModelId(modelConfig?.model)
  if (selectedModel && OLD_XAI_GROK_MODEL_REPLACEMENTS[selectedModel]) {
    return OLD_XAI_GROK_MODEL_REPLACEMENTS[selectedModel]
  }

  if (modelConfig?.isCustomModel !== true) {
    return null
  }

  const customModel = getNormalizedModelId(modelConfig?.customModel)
  return customModel === null
    ? null
    : OLD_XAI_GROK_MODEL_REPLACEMENTS[customModel] ?? null
}

function migrateProviderConfig(providerConfig: any): any {
  if (!providerConfig || typeof providerConfig !== "object") {
    return providerConfig
  }

  const modelConfig = providerConfig.model
  if (providerConfig.provider !== "xai" || !modelConfig || typeof modelConfig !== "object") {
    return providerConfig
  }

  const migratedModel = getMigratedXaiModel(modelConfig)
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
