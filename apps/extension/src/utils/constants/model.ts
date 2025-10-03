import type { AnthropicProviderOptions } from '@ai-sdk/anthropic'
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import type { JSONValue } from 'ai'
import { THINKING_MODELS } from '@/types/config/provider'

const DEFAULT_THINKING_BUDGET = 128

export function getProviderOptions(translateModel: string): Record<string, Record<string, JSONValue>> {
  return {
    google: {
      thinkingConfig: {
        thinkingBudget: THINKING_MODELS.includes(translateModel as (typeof THINKING_MODELS)[number]) ? DEFAULT_THINKING_BUDGET : 0,
      },
    } satisfies GoogleGenerativeAIProviderOptions,
    anthropic: {
      thinking: { type: 'disabled' },
    } satisfies AnthropicProviderOptions,
    openai: {
      reasoningEffort: 'minimal',
    } satisfies OpenAIResponsesProviderOptions,
  }
}
