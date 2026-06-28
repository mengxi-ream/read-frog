/**
 * Migration script from v081 to v082
 * - Adds default OpenAI-compatible base URLs for OpenRouter and MiniMax.
 * - Converts simple providerOptions reasoning effort settings to top-level reasoning.
 * - Defaults missing top-level reasoning settings to none for providers without custom provider options.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const MINIMAX_OPENAI_COMPATIBLE_BASE_URL = "https://api.minimax.io/v1"
const OLD_MINIMAX_ANTHROPIC_BASE_URLS = new Set([
  "https://api.minimaxi.com/anthropic/v1",
  "https://api.minimax.io/anthropic/v1",
])
const TOP_LEVEL_REASONING_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "google",
  "xai",
  "groq",
  "deepseek",
  "fireworks",
  "bedrock",
])
const REASONING_VALUES = new Set([
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
])

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === ""
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  return value.trim().replace(/\/+$/, "")
}

function migrateSimpleReasoningOptions(provider: any): any {
  if (!TOP_LEVEL_REASONING_PROVIDERS.has(provider.provider)) {
    return provider
  }

  if (provider.reasoning !== undefined) {
    return provider
  }

  const providerOptions = provider.providerOptions
  if (!providerOptions || typeof providerOptions !== "object" || Array.isArray(providerOptions)) {
    return {
      ...provider,
      reasoning: "none",
    }
  }

  const keys = Object.keys(providerOptions)
  if (keys.length !== 1 || (keys[0] !== "reasoningEffort" && keys[0] !== "reasoning_effort")) {
    return provider
  }

  const reasoning = providerOptions[keys[0]]
  if (typeof reasoning !== "string" || !REASONING_VALUES.has(reasoning)) {
    return provider
  }

  const { providerOptions: _providerOptions, ...rest } = provider
  return {
    ...rest,
    reasoning,
  }
}

function migrateProvider(provider: any): any {
  if (!provider || typeof provider !== "object") {
    return provider
  }

  let nextProvider = provider

  if (provider.provider === "openrouter" && isBlank(provider.baseURL)) {
    nextProvider = {
      ...nextProvider,
      baseURL: OPENROUTER_BASE_URL,
    }
  }

  if (provider.provider === "minimax") {
    const normalizedBaseUrl = normalizeUrl(provider.baseURL)
    if (isBlank(provider.baseURL) || (normalizedBaseUrl !== null && OLD_MINIMAX_ANTHROPIC_BASE_URLS.has(normalizedBaseUrl))) {
      nextProvider = {
        ...nextProvider,
        baseURL: MINIMAX_OPENAI_COMPATIBLE_BASE_URL,
      }
    }
  }

  return migrateSimpleReasoningOptions(nextProvider)
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  if (!Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    providersConfig: oldConfig.providersConfig.map(migrateProvider),
  }
}
