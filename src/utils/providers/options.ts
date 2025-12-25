import type { JSONValue } from 'ai'
import { TRANSLATE_MODEL_OPTIONS } from '../constants/models'

/**
 * Get provider options for AI SDK generateText calls.
 * Matches model name against patterns and returns options for the current provider.
 * First match wins - more specific patterns should be placed first in MODEL_OPTIONS.
 */
export function getProviderOptions(
  model: string,
  provider: string,
): Record<string, Record<string, JSONValue>> {
  for (const { pattern, options } of TRANSLATE_MODEL_OPTIONS) {
    if (pattern.test(model)) {
      return { [provider]: options }
    }
  }
  return {}
}

/**
 * Get provider options for AI SDK generateText calls.
 * If user-defined options exist, use them directly (no merge).
 * Otherwise fall back to default pattern-matched options.
 */
export function getProviderOptionsWithOverride(
  model: string,
  provider: string,
  userOptions?: Record<string, JSONValue>,
): Record<string, Record<string, JSONValue>> {
  // User options completely override defaults
  if (userOptions && Object.keys(userOptions).length > 0) {
    return { [provider]: userOptions }
  }

  return getProviderOptions(model, provider)
}
