import type { JSONValue } from "ai"
import { getOpenAIGPT5ReasoningEffortPolicy, LLM_MODEL_OPTIONS } from "../constants/models"

export interface RecommendedProviderOptionsMatch {
  matchIndex: number
  options: Record<string, JSONValue>
}

/**
 * Detect the recommended provider options for a given model.
 * First match wins - more specific patterns should be placed first in MODEL_OPTIONS.
 */
export function getRecommendedProviderOptionsMatch(model: string): RecommendedProviderOptionsMatch | undefined {
  for (const [matchIndex, { pattern, options }] of LLM_MODEL_OPTIONS.entries()) {
    if (pattern.test(model)) {
      return { matchIndex, options }
    }
  }
}

/**
 * Get the recommended provider options payload without wrapping it by provider id.
 */
export function getRecommendedProviderOptions(model: string): Record<string, JSONValue> | undefined {
  return getRecommendedProviderOptionsMatch(model)?.options
}

function sanitizeOpenAIProviderOptions(model: string, options: Record<string, JSONValue>): Record<string, JSONValue> {
  const policy = getOpenAIGPT5ReasoningEffortPolicy(model)
  if (!policy || !Object.hasOwn(options, "reasoningEffort")) {
    return options
  }

  const reasoningEffort = options.reasoningEffort
  if (typeof reasoningEffort !== "string" || policy.supportedValues.includes(reasoningEffort)) {
    return options
  }

  const sanitizedOptions = { ...options }
  if (policy.recommendedValue === undefined) {
    delete sanitizedOptions.reasoningEffort
  }
  else {
    sanitizedOptions.reasoningEffort = policy.recommendedValue
  }

  return sanitizedOptions
}

function sanitizeProviderOptions(
  model: string,
  provider: string,
  options: Record<string, JSONValue>,
): Record<string, JSONValue> {
  if (provider !== "openai") {
    return options
  }

  return sanitizeOpenAIProviderOptions(model, options)
}

/**
 * Wrap a recommendation for the AI SDK request shape.
 */
export function getProviderOptions(
  model: string,
  provider: string,
): Record<string, Record<string, JSONValue>> {
  const options = getRecommendedProviderOptions(model)
  if (!options) {
    return {}
  }

  return { [provider]: sanitizeProviderOptions(model, provider, options) }
}

/**
 * Get provider options for AI SDK calls.
 * - If the user has saved provider options (including `{}`), use them as-is,
 *   except for known-invalid OpenAI reasoningEffort values that must be coerced.
 * - Otherwise fall back to the recommended defaults for the current model.
 */
export function getProviderOptionsWithOverride(
  model: string,
  provider: string,
  userOptions?: Record<string, JSONValue>,
): Record<string, Record<string, JSONValue>> | undefined {
  if (userOptions !== undefined) {
    return { [provider]: sanitizeProviderOptions(model, provider, userOptions) }
  }

  const recommendedOptions = getRecommendedProviderOptions(model)
  if (!recommendedOptions) {
    return undefined
  }

  return { [provider]: sanitizeProviderOptions(model, provider, recommendedOptions) }
}
