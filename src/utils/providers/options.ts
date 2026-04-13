import type { JSONValue } from "ai"
import { CUSTOM_LLM_PROVIDER_TYPES } from "@/types/config/provider"
import { LLM_MODEL_OPTIONS } from "../constants/models"

export interface RecommendedProviderOptionsMatch {
  matchIndex: number
  options: Record<string, JSONValue>
}

const OPENAI_COMPATIBLE_PROVIDER_TYPES = new Set<string>(CUSTOM_LLM_PROVIDER_TYPES)
const UNSUPPORTED_PROVIDER_OPTION_KEYS = {
  cerebras: ["enableThinking"],
} as const satisfies Partial<Record<string, readonly string[]>>

const OPENAI_COMPATIBLE_OPTION_ALIASES = {
  reasoning_effort: "reasoningEffort",
  verbosity: "textVerbosity",
} as const satisfies Record<string, string>

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

function pruneUnsupportedProviderOptions(
  provider: string,
  options: Record<string, JSONValue>,
): Record<string, JSONValue> {
  const unsupportedKeys = UNSUPPORTED_PROVIDER_OPTION_KEYS[provider as keyof typeof UNSUPPORTED_PROVIDER_OPTION_KEYS]
  if (!unsupportedKeys?.length) {
    return options
  }

  let changed = false
  const sanitizedOptions: Record<string, JSONValue> = {}

  for (const [key, value] of Object.entries(options)) {
    if (unsupportedKeys.includes(key)) {
      changed = true
      continue
    }

    sanitizedOptions[key] = value
  }

  return changed ? sanitizedOptions : options
}

function getSupportedProviderOptions(
  options: Record<string, JSONValue>,
  provider?: string,
): Record<string, JSONValue> | undefined {
  if (!provider) {
    return options
  }

  const supportedOptions = pruneUnsupportedProviderOptions(provider, options)
  return Object.keys(supportedOptions).length > 0 ? supportedOptions : undefined
}

/**
 * Detect the recommended provider options for a given model/provider pair.
 * First match wins - more specific patterns should be placed first in MODEL_OPTIONS.
 */
export function getRecommendedProviderOptionsMatch(
  model: string,
  provider?: string,
): RecommendedProviderOptionsMatch | undefined {
  for (const [matchIndex, { pattern, options }] of LLM_MODEL_OPTIONS.entries()) {
    if (pattern.test(model)) {
      const supportedOptions = getSupportedProviderOptions(options, provider)
      if (!supportedOptions) {
        return undefined
      }

      return { matchIndex, options: supportedOptions }
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
    return {
      [provider]: pruneUnsupportedProviderOptions(
        provider,
        normalizeUserProviderOptions(provider, userOptions),
      ),
    }
  }

  const recommendedOptions = getRecommendedProviderOptions(model, provider)
  if (!recommendedOptions) {
    return undefined
  }

  return { [provider]: recommendedOptions }
}
