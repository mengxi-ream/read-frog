import type { JSONValue } from 'ai'
import { MODEL_SPECIFIC_OPTIONS, PROVIDER_OPTIONS_CONFIG } from './models'

/**
 * Match model against a pattern (string array or RegExp)
 */
function matchesPattern(model: string, pattern: readonly string[] | RegExp): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(model)
  }
  return pattern.includes(model)
}

/**
 * Get options for a specific provider based on model name
 */
function getOptionsForProvider(
  providerConfig: {
    default: Record<string, JSONValue>
    modelPatterns?: readonly { match: readonly string[] | RegExp, options: Record<string, JSONValue> }[]
  },
  model: string,
): Record<string, JSONValue> {
  // Check model-specific patterns first
  if (providerConfig.modelPatterns) {
    for (const { match, options } of providerConfig.modelPatterns) {
      if (matchesPattern(model, match)) {
        return options as Record<string, JSONValue>
      }
    }
  }
  // Fall back to default
  return providerConfig.default as Record<string, JSONValue>
}

/**
 * Get provider options for AI SDK generateText calls.
 * Returns configured options for all standard providers, with optional
 */
export function getProviderOptions(
  translateModel: string,
  providerName?: string,
): Record<string, Record<string, JSONValue>> {
  // Build options for all configured providers
  const options: Record<string, Record<string, JSONValue>> = {}

  for (const [provider, config] of Object.entries(PROVIDER_OPTIONS_CONFIG)) {
    options[provider] = getOptionsForProvider(config, translateModel)
  }

  // Apply model-specific overrides for custom providers (e.g., GLM models)
  if (providerName) {
    for (const { pattern, options: modelOptions } of MODEL_SPECIFIC_OPTIONS) {
      if (pattern.test(translateModel)) {
        options[providerName] = modelOptions
        break
      }
    }
  }

  return options
}
