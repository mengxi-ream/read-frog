import type { JSONValue } from "ai"
import { CUSTOM_LLM_PROVIDER_TYPES } from "@/types/config/provider"
import { LLM_MODEL_OPTIONS } from "../constants/models"

export interface RecommendedProviderOptionsMatch {
  matchIndex: number
  options: Record<string, JSONValue>
}

const OPENAI_COMPATIBLE_PROVIDER_TYPES = new Set<string>(CUSTOM_LLM_PROVIDER_TYPES)
const UNSUPPORTED_RECOMMENDED_OPTION_KEYS: Partial<Record<string, readonly string[]>> = {
  cerebras: ["enableThinking"],
}

const OPENAI_COMPATIBLE_OPTION_ALIASES = {
  reasoning_effort: "reasoningEffort",
  verbosity: "textVerbosity",
} as const satisfies Record<string, string>

function filterUnsupportedRecommendedOptions(
  provider: string | undefined,
  options: Record<string, JSONValue>,
): Record<string, JSONValue> | undefined {
  if (!provider) {
    return options
  }

  const unsupportedKeys = UNSUPPORTED_RECOMMENDED_OPTION_KEYS[provider]
  if (!unsupportedKeys?.length) {
    return options
  }

  let filteredOptions: Record<string, JSONValue> | undefined

  for (const unsupportedKey of unsupportedKeys) {
    if (!(unsupportedKey in options)) {
      continue
    }

    filteredOptions ??= { ...options }
    delete filteredOptions[unsupportedKey]
  }

  if (!filteredOptions) {
    return options
  }

  return Object.keys(filteredOptions).length > 0 ? filteredOptions : undefined
}

function normalizeUserProviderOptions(
  provider: string,
  userOptions: Record<string, JSONValue>,
): Record<string, JSONValue> {
  if (!OPENAI_COMPATIBLE_PROVIDER_TYPES.has(provider)) {
    return userOptions
  }

  let changed = false
  const normalizedOptions: Record<string, JSONValue> = { ...userOptions }

  for (const [rawKey, canonicalKey] of Object.entries(OPENAI_COMPATIBLE_OPTION_ALIASES)) {
    if (!(rawKey in normalizedOptions)) {
      continue
    }

    if (!(canonicalKey in normalizedOptions)) {
      normalizedOptions[canonicalKey] = normalizedOptions[rawKey]
    }

    delete normalizedOptions[rawKey]
    changed = true
  }

  return changed ? normalizedOptions : userOptions
}

/**
 * Detect the recommended provider options for a given model.
 * First match wins - more specific patterns should be placed first in MODEL_OPTIONS.
 */
export function getRecommendedProviderOptionsMatch(
  model: string,
  provider?: string,
): RecommendedProviderOptionsMatch | undefined {
  for (const [matchIndex, { pattern, options }] of LLM_MODEL_OPTIONS.entries()) {
    if (pattern.test(model)) {
      const filteredOptions = filterUnsupportedRecommendedOptions(provider, options)
      if (!filteredOptions) {
        return undefined
      }

      return { matchIndex, options: filteredOptions }
    }
  }
}

/**
 * Get the recommended provider options payload without wrapping it by provider id.
 */
export function getRecommendedProviderOptions(
  model: string,
  provider?: string,
): Record<string, JSONValue> | undefined {
  return getRecommendedProviderOptionsMatch(model, provider)?.options
}

/**
 * Wrap a recommendation for the AI SDK request shape.
 */
export function getProviderOptions(
  model: string,
  provider: string,
): Record<string, Record<string, JSONValue>> {
  const options = getRecommendedProviderOptions(model, provider)
  if (!options) {
    return {}
  }

  return { [provider]: options }
}

/**
 * Get provider options for AI SDK calls.
 * - If the user has saved provider options (including `{}`), use them as-is.
 * - Otherwise fall back to the recommended defaults for the current model.
 */
export function getProviderOptionsWithOverride(
  model: string,
  provider: string,
  userOptions?: Record<string, JSONValue>,
): Record<string, Record<string, JSONValue>> | undefined {
  if (userOptions !== undefined) {
    return { [provider]: normalizeUserProviderOptions(provider, userOptions) }
  }

  const recommendedOptions = getRecommendedProviderOptions(model, provider)
  if (!recommendedOptions) {
    return undefined
  }

  return { [provider]: recommendedOptions }
}
