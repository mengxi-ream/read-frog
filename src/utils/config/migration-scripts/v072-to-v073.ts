/**
 * Migration script from v072 to v073
 * - Converts legacy 302.AI providers to OpenAI-compatible custom providers.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined
}

function resolveCustomModel(provider: any): string | null {
  return getNonEmptyString(provider?.model?.customModel)
    ?? getNonEmptyString(provider?.model?.model)
    ?? null
}

function migrateProvider(provider: any): any {
  if (!isRecord(provider) || provider.provider !== "ai302") {
    return provider
  }

  return {
    ...provider,
    provider: "openai-compatible",
    baseURL: getNonEmptyString(provider.baseURL) ?? "https://api.302.ai/v1",
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: resolveCustomModel(provider),
    },
  }
}

export function migrate(oldConfig: any): any {
  if (!Array.isArray(oldConfig?.providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: oldConfig.providersConfig.map(migrateProvider),
  }
}
