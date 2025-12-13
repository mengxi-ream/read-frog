import type { AnthropicProviderOptions } from '@ai-sdk/anthropic'
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import type { JSONValue } from 'ai'
import { THINKING_MODELS } from '@/types/config/provider'

const DEFAULT_THINKING_BUDGET = 128

export function getProviderOptions(translateModel: string, providerName?: string): Record<string, Record<string, JSONValue>> {
  const options = {
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
  } as Record<string, Record<string, JSONValue>>

  if (providerName && (translateModel.includes('GLM') || translateModel.includes('glm'))) {
    options[providerName] = {
      thinking: {
        type: 'disabled',
      },
    }
  }

  return options
}
