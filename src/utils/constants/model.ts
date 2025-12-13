import type { AnthropicProviderOptions } from '@ai-sdk/anthropic'
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import type { JSONValue } from 'ai'
import { THINKING_MODELS } from '@/types/config/provider'

const DEFAULT_THINKING_BUDGET = 128

/**
 * Model-specific provider options configuration.
 * Used to apply special configurations for certain models that need custom behavior.
 */
const MODEL_SPECIFIC_OPTIONS: Array<{
  pattern: RegExp
  options: Record<string, JSONValue>
}> = [
  {
    // GLM models have issues with thinking mode, causing errors or unexpected behavior
    // Disable thinking for all GLM-* models (case-insensitive)
    pattern: /^GLM-/i,
    options: { thinking: { type: 'disabled' } },
  },
]

export function getProviderOptions(translateModel: string, providerName?: string): Record<string, Record<string, JSONValue>> {
  const options: Record<string, Record<string, JSONValue>> = {
    google: {
      thinkingConfig: {
        thinkingBudget: THINKING_MODELS.includes(translateModel) ? DEFAULT_THINKING_BUDGET : 0,
        includeThoughts: false,
      },
    } satisfies GoogleGenerativeAIProviderOptions,
    anthropic: {
      thinking: { type: 'disabled' },
    } satisfies AnthropicProviderOptions,
    openai: {
      reasoningEffort: 'minimal',
    } satisfies OpenAIResponsesProviderOptions,
  }

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
