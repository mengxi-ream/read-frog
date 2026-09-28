/**
 * Migration script from v106 to v107.
 *
 * - Perplexity moved from Sonar Chat Completions to its Agent API
 *   (`@ai-sdk/perplexity` 5), which retired every `sonar*` model id. Stored
 *   Perplexity providers are moved to an Agent API model: `sonar` to the direct
 *   `perplexity/sonar` model (no built-in tools, so no web search on every
 *   translation), and the larger Sonar models to the preset upstream suggests
 *   for them. A custom model that is a Sonar id is moved the same way.
 * - The Vercel v0 Model API was shut down and `@ai-sdk/vercel` removed, so
 *   stored Vercel providers become OpenAI-compatible custom providers, keeping
 *   their id, name, key and model so every feature pointing at them still
 *   resolves (as v072-to-v073 did for 302.AI).
 *
 * Providers already on v105 shapes are returned by identity, so a second run
 * changes nothing.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const PERPLEXITY_DEFAULT_MODEL = "perplexity/sonar"

const PERPLEXITY_MODELS = ["perplexity/sonar", "fast", "low", "medium", "high", "xhigh"]

const PERPLEXITY_SONAR_REPLACEMENTS: Record<string, string> = {
  sonar: "perplexity/sonar",
  "sonar-pro": "low",
  "sonar-reasoning": "medium",
  "sonar-reasoning-pro": "medium",
  "sonar-deep-research": "high",
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function replaceSonarModel(model: unknown): unknown {
  return typeof model === "string" && Object.hasOwn(PERPLEXITY_SONAR_REPLACEMENTS, model)
    ? PERPLEXITY_SONAR_REPLACEMENTS[model]
    : model
}

function migratePerplexityProvider(provider: Record<string, any>): Record<string, any> {
  if (!isRecord(provider.model)) {
    return provider
  }

  const replacedModel = replaceSonarModel(provider.model.model)
  const model =
    typeof replacedModel === "string" && PERPLEXITY_MODELS.includes(replacedModel)
      ? replacedModel
      : PERPLEXITY_DEFAULT_MODEL
  const customModel = replaceSonarModel(provider.model.customModel)

  if (model === provider.model.model && customModel === provider.model.customModel) {
    return provider
  }

  return {
    ...provider,
    model: {
      ...provider.model,
      model,
      customModel,
    },
  }
}

function migrateVercelProvider(provider: Record<string, any>): Record<string, any> {
  return {
    ...provider,
    provider: "openai-compatible",
    baseURL: getNonEmptyString(provider.baseURL) ?? "https://api.v0.dev/v1",
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel:
        getNonEmptyString(provider.model?.customModel) ??
        getNonEmptyString(provider.model?.model) ??
        null,
    },
  }
}

function migrateProvider(provider: unknown): unknown {
  if (!isRecord(provider)) {
    return provider
  }

  if (provider.provider === "perplexity") {
    return migratePerplexityProvider(provider)
  }

  if (provider.provider === "vercel") {
    return migrateVercelProvider(provider)
  }

  return provider
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
