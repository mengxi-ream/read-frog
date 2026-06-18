/**
 * Migration script from v078 to v079
 * - Converts removed AI SDK docs-driven provider model ids into custom model entries.
 * - Preserves the original deprecated id in `customModel`.
 * - Switches the selector-backed `model` field to a valid current option so schema validation still passes.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

const DEPRECATED_PROVIDER_MODEL_FALLBACKS: Record<string, Record<string, string>> = {
  anthropic: {
    "claude-3-7-sonnet-latest": "claude-haiku-4-5",
    "claude-3-5-haiku-latest": "claude-haiku-4-5",
  },
  google: {
    "gemini-3.1-flash-lite": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-8b": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-8b-latest": "gemini-2.5-flash-lite",
    "gemini-1.5-flash": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-latest": "gemini-2.5-flash-lite",
    "gemini-1.5-pro": "gemini-2.5-pro",
    "gemini-1.5-pro-latest": "gemini-2.5-pro",
  },
  xai: {
    "grok-4-0709": "grok-4.20-non-reasoning",
    "grok-4-latest": "grok-4.20-non-reasoning",
    "grok-4": "grok-4.20-non-reasoning",
    "grok-3-mini-fast": "grok-3-mini",
    "grok-3-mini-fast-latest": "grok-3-mini",
    "grok-3-mini-latest": "grok-3-mini",
    "grok-3-fast": "grok-3",
    "grok-3-fast-latest": "grok-3",
    "grok-3-latest": "grok-3",
    "grok-2": "grok-4.20-non-reasoning",
    "grok-2-latest": "grok-4.20-non-reasoning",
    "grok-2-1212": "grok-4.20-non-reasoning",
    "grok-2-vision": "grok-4.20-non-reasoning",
    "grok-2-vision-latest": "grok-4.20-non-reasoning",
    "grok-2-vision-1212": "grok-4.20-non-reasoning",
    "grok-beta": "grok-4.20-non-reasoning",
    "grok-vision-beta": "grok-4.20-non-reasoning",
  },
  bedrock: {
    "anthropic.claude-3-7-sonnet-20250219-v1:0": "us.amazon.nova-micro-v1:0",
    "us.anthropic.claude-3-7-sonnet-20250219-v1:0": "us.amazon.nova-micro-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0": "us.amazon.nova-micro-v1:0",
    "us.anthropic.claude-3-5-haiku-20241022-v1:0": "us.amazon.nova-micro-v1:0",
  },
  groq: {
    "meta-llama/llama-guard-4-12b": "llama-3.1-8b-instant",
    "llama-guard-3-8b": "llama-3.1-8b-instant",
    "meta-llama/llama-prompt-guard-2-22m": "llama-3.1-8b-instant",
    "meta-llama/llama-prompt-guard-2-86m": "llama-3.1-8b-instant",
  },
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function getMigratedCustomModel(modelConfig: { customModel?: unknown, isCustomModel?: unknown }, previousModel: string): string {
  if (modelConfig.isCustomModel === true) {
    return getNonEmptyString(modelConfig.customModel) ?? previousModel
  }

  return previousModel
}

function migrateProviderConfig(providerConfig: any): any {
  if (!providerConfig || typeof providerConfig !== "object") {
    return providerConfig
  }

  const provider = providerConfig.provider
  const modelConfig = providerConfig.model
  if (typeof provider !== "string" || !modelConfig || typeof modelConfig !== "object") {
    return providerConfig
  }

  const previousModel = modelConfig.model
  if (typeof previousModel !== "string") {
    return providerConfig
  }

  const fallbackModel = DEPRECATED_PROVIDER_MODEL_FALLBACKS[provider]?.[previousModel]
  if (!fallbackModel) {
    return providerConfig
  }

  return {
    ...providerConfig,
    model: {
      ...modelConfig,
      model: fallbackModel,
      isCustomModel: true,
      customModel: getMigratedCustomModel(modelConfig, previousModel),
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
