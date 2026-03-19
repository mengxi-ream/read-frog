import type { JSONValue } from "ai"
import { LLM_MODEL_OPTIONS } from "../constants/models"

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

  return { [provider]: options }
}

/**
 * Get provider options for AI SDK generateText calls using only user-saved overrides.
 * Recommendations stay in the UI until the user explicitly applies and saves them.
 */
export function getProviderOptionsWithOverride(
  _model: string,
  provider: string,
  userOptions?: Record<string, JSONValue>,
): Record<string, Record<string, JSONValue>> | undefined {
  if (!userOptions || Object.keys(userOptions).length === 0) {
    return undefined
  }

  return { [provider]: userOptions }
}
