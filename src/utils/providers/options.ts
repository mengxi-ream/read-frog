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
