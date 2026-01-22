import type { AnthropicProviderOptions } from '@ai-sdk/anthropic'
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google'
import type { OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import type { JSONValue } from 'ai'

export const READ_PROVIDER_MODELS = {
  'openai': ['gpt-5.2-pro', 'gpt-5.2', 'gpt-5.2-chat-latest', 'gpt-5.1-codex', 'gpt-5.1', 'gpt-5.1-codex-mini', 'gpt-5.1-chat-latest', 'gpt-5-pro', 'gpt-5-codex', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini'],
  'deepseek': ['deepseek-chat', 'deepseek-reasoner'],
  'google': ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-lite-preview-06-17', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-8b', 'gemini-1.5-flash-8b-latest'],
  'anthropic': ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1', 'claude-opus-4-0', 'claude-sonnet-4-0', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  'siliconflow': ['Qwen/Qwen3-Next-80B-A3B-Instruct'],
  'tensdaq': ['MiniMax-M2', 'deepseek-v3.1'],
  'ai302': ['gpt-4.1-mini', 'qwen3-235b-a22b'],
  'openai-compatible': ['use-custom-model'],
  'xai': ['grok-4', 'grok-4-fast-reasoning', 'grok-4-fast-non-reasoning', 'grok-code-fast-1', 'grok-3', 'grok-3-latest', 'grok-3-fast', 'grok-3-fast-latest', 'grok-3-mini', 'grok-3-mini-latest', 'grok-3-mini-fast', 'grok-3-mini-fast-latest', 'grok-2', 'grok-2-latest', 'grok-2-1212', 'grok-2-vision', 'grok-2-vision-latest', 'grok-2-vision-1212', 'grok-beta', 'grok-vision-beta'],
  'bedrock': ['us.meta.llama4-maverick-17b-instruct-v1:0', 'us.meta.llama4-scout-17b-instruct-v1:0', 'us.deepseek.r1-v1:0', 'anthropic.claude-opus-4-1-20250805-v1:0', 'us.anthropic.claude-opus-4-1-20250805-v1:0', 'anthropic.claude-opus-4-20250514-v1:0', 'us.anthropic.claude-opus-4-20250514-v1:0', 'anthropic.claude-sonnet-4-5-20250929-v1:0', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'anthropic.claude-sonnet-4-20250514-v1:0', 'us.anthropic.claude-sonnet-4-20250514-v1:0', 'anthropic.claude-haiku-4-5-20251001-v1:0', 'anthropic.claude-3-7-sonnet-20250219-v1:0', 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', 'us.amazon.nova-premier-v1:0', 'us.amazon.nova-pro-v1:0', 'us.amazon.nova-lite-v1:0', 'us.amazon.nova-micro-v1:0', 'anthropic.claude-3-5-sonnet-20241022-v2:0', 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', 'anthropic.claude-3-5-haiku-20241022-v1:0', 'us.anthropic.claude-3-5-haiku-20241022-v1:0', 'us.meta.llama3-3-70b-instruct-v1:0', 'us.mistral.pixtral-large-2502-v1:0', 'meta.llama3-1-405b-instruct-v1:0', 'meta.llama3-1-70b-instruct-v1:0', 'us.meta.llama3-1-70b-instruct-v1:0', 'meta.llama3-1-8b-instruct-v1:0', 'us.meta.llama3-1-8b-instruct-v1:0', 'meta.llama3-2-3b-instruct-v1:0', 'us.meta.llama3-2-3b-instruct-v1:0', 'meta.llama3-2-1b-instruct-v1:0', 'us.meta.llama3-2-1b-instruct-v1:0'],
  'groq': ['meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct', 'moonshotai/kimi-k2-instruct-0905', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'deepseek-r1-distill-llama-70b', 'deepseek-r1-distill-qwen-32b', 'qwen-qwq-32b', 'qwen-2.5-32b', 'qwen/qwen3-32b', 'openai/gpt-oss-20b', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'meta-llama/llama-guard-4-12b', 'gemma2-9b-it', 'llama-3.1-8b-instant', 'llama3-8b-8192', 'llama-guard-3-8b', 'meta-llama/llama-prompt-guard-2-86m', 'meta-llama/llama-prompt-guard-2-22m'],
  'deepinfra': ['meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', 'meta-llama/Llama-4-Scout-17B-16E-Instruct', 'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-R1-Turbo', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Llama-3.2-90B-Vision-Instruct', 'meta-llama/Llama-3.2-11B-Vision-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/QwQ-32B-Preview', 'meta-llama/Meta-Llama-3.1-405B-Instruct', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct', 'nvidia/Llama-3.1-Nemotron-70B-Instruct', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct', 'microsoft/WizardLM-2-8x22B', 'Qwen/Qwen2-7B-Instruct', 'google/gemma-2-9b-it', 'google/codegemma-7b-it', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
  'mistral': ['magistral-medium-2506', 'magistral-small-2506', 'pixtral-large-latest', 'mistral-large-latest', 'mistral-medium-2505', 'mistral-medium-latest', 'mistral-small-latest', 'ministral-8b-latest', 'ministral-3b-latest', 'pixtral-12b-2409', 'open-mixtral-8x22b', 'open-mixtral-8x7b', 'open-mistral-7b'],
  'togetherai': ['deepseek-ai/DeepSeek-V3', 'meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'databricks/dbrx-instruct', 'mistralai/Mistral-7B-Instruct-v0.3', 'google/gemma-2b-it'],
  'cohere': ['command-a-reasoning-08-2025', 'command-a-03-2025', 'command-r-plus-04-2024', 'command-r-08-2024', 'command-r7b-12-2024', 'command-r-03-2024', 'command-r-plus', 'command-r', 'command', 'command-nightly', 'command-light', 'command-light-nightly'],
  'fireworks': ['accounts/fireworks/models/kimi-k2-instruct', 'accounts/fireworks/models/deepseek-r1', 'accounts/fireworks/models/deepseek-v3', 'accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p2-11b-vision-instruct', 'accounts/fireworks/models/llama-v3p2-3b-instruct', 'accounts/fireworks/models/qwen2-vl-72b-instruct', 'accounts/fireworks/models/qwen2p5-72b-instruct', 'accounts/fireworks/models/qwen2p5-coder-32b-instruct', 'accounts/fireworks/models/qwq-32b', 'accounts/fireworks/models/qwen-qwq-32b-preview', 'accounts/fireworks/models/llama-v3p1-405b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct-hf', 'accounts/fireworks/models/yi-large', 'accounts/fireworks/models/firefunction-v1'],
  'cerebras': ['qwen-3-235b-a22b-thinking-2507', 'qwen-3-235b-a22b-instruct-2507', 'zai-glm-4.6', 'gpt-oss-120b', 'llama-3.3-70b', 'qwen-3-32b', 'llama3.1-8b'],
  'replicate': ['meta/meta-llama-3.1-405b-instruct', 'meta/meta-llama-3.1-70b-instruct', 'meta/meta-llama-3.1-8b-instruct'],
  'perplexity': ['sonar-deep-research', 'sonar-reasoning-pro', 'sonar-reasoning', 'sonar-pro', 'sonar'],
  'vercel': ['v0-1.5-lg', 'v0-1.5-md', 'v0-1.0-md'],
  'openrouter': ['deepseek/deepseek-chat-v3.1:free', 'openai/gpt-4.1-mini'],
  'ollama': ['gemma3:27b', 'deepseek-v3'],
  'volcengine': ['doubao-seed-1-6-251015', 'doubao-seed-1-6-lite-251015', 'doubao-seed-1-6-flash-250828'],
  'minimax': ['MiniMax-M2', 'MiniMax-M2-Stable'],
} as const
export const TRANSLATE_PROVIDER_MODELS = {
  'openai': ['gpt-5.2-chat-latest', 'gpt-5.2', 'gpt-5.2-pro', 'gpt-5.1-chat-latest', 'gpt-5.1-codex-mini', 'gpt-5.1', 'gpt-5.1-codex', 'gpt-5-chat-latest', 'gpt-5-nano', 'gpt-5-mini', 'gpt-5', 'gpt-5-codex', 'gpt-5-pro', 'gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
  'deepseek': ['deepseek-chat', 'deepseek-reasoner'],
  'google': ['gemini-3-pro-preview', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-lite-preview-06-17', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-flash-8b-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-1.5-pro-latest'],
  'anthropic': ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-opus-4-1', 'claude-sonnet-4-0', 'claude-opus-4-0', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  'siliconflow': ['Qwen/Qwen3-Next-80B-A3B-Instruct'],
  'tensdaq': ['Qwen3-30B-A3B-Instruct-2507', 'deepseek-v3.1'],
  'ai302': ['gpt-4.1-mini', 'qwen3-235b-a22b'],
  'openai-compatible': ['use-custom-model'],
  'xai': ['grok-4-fast-non-reasoning', 'grok-4-fast-reasoning', 'grok-4', 'grok-code-fast-1', 'grok-3-mini-fast', 'grok-3-mini-fast-latest', 'grok-3-mini', 'grok-3-mini-latest', 'grok-3-fast', 'grok-3-fast-latest', 'grok-3', 'grok-3-latest', 'grok-2', 'grok-2-latest', 'grok-2-1212', 'grok-2-vision', 'grok-2-vision-latest', 'grok-2-vision-1212', 'grok-beta', 'grok-vision-beta'],
  'bedrock': ['us.meta.llama4-scout-17b-instruct-v1:0', 'us.meta.llama4-maverick-17b-instruct-v1:0', 'us.deepseek.r1-v1:0', 'anthropic.claude-haiku-4-5-20251001-v1:0', 'anthropic.claude-sonnet-4-5-20250929-v1:0', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'anthropic.claude-sonnet-4-20250514-v1:0', 'us.anthropic.claude-sonnet-4-20250514-v1:0', 'anthropic.claude-opus-4-1-20250805-v1:0', 'us.anthropic.claude-opus-4-1-20250805-v1:0', 'anthropic.claude-opus-4-20250514-v1:0', 'us.anthropic.claude-opus-4-20250514-v1:0', 'anthropic.claude-3-7-sonnet-20250219-v1:0', 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', 'us.amazon.nova-micro-v1:0', 'us.amazon.nova-lite-v1:0', 'us.amazon.nova-pro-v1:0', 'us.amazon.nova-premier-v1:0', 'anthropic.claude-3-5-haiku-20241022-v1:0', 'us.anthropic.claude-3-5-haiku-20241022-v1:0', 'anthropic.claude-3-5-sonnet-20241022-v2:0', 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', 'us.meta.llama3-3-70b-instruct-v1:0', 'us.mistral.pixtral-large-2502-v1:0', 'meta.llama3-2-1b-instruct-v1:0', 'meta.llama3-2-3b-instruct-v1:0', 'us.meta.llama3-2-1b-instruct-v1:0', 'us.meta.llama3-2-3b-instruct-v1:0', 'meta.llama3-1-8b-instruct-v1:0', 'us.meta.llama3-1-8b-instruct-v1:0', 'meta.llama3-1-70b-instruct-v1:0', 'us.meta.llama3-1-70b-instruct-v1:0', 'meta.llama3-1-405b-instruct-v1:0'],
  'groq': ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'moonshotai/kimi-k2-instruct-0905', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'qwen-2.5-32b', 'qwen-qwq-32b', 'deepseek-r1-distill-qwen-32b', 'deepseek-r1-distill-llama-70b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant', 'llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'meta-llama/llama-guard-4-12b', 'llama-guard-3-8b', 'meta-llama/llama-prompt-guard-2-22m', 'meta-llama/llama-prompt-guard-2-86m'],
  'deepinfra': ['meta-llama/Llama-4-Scout-17B-16E-Instruct', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', 'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-R1-Turbo', 'deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', 'meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-3.2-11B-Vision-Instruct', 'meta-llama/Llama-3.2-90B-Vision-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/QwQ-32B-Preview', 'meta-llama/Meta-Llama-3.1-8B-Instruct', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-405B-Instruct', 'nvidia/Llama-3.1-Nemotron-70B-Instruct', 'microsoft/WizardLM-2-8x22B', 'Qwen/Qwen2-7B-Instruct', 'google/gemma-2-9b-it', 'google/codegemma-7b-it', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
  'mistral': ['magistral-small-2506', 'magistral-medium-2506', 'ministral-3b-latest', 'ministral-8b-latest', 'mistral-small-latest', 'mistral-medium-latest', 'mistral-medium-2505', 'mistral-large-latest', 'pixtral-12b-2409', 'pixtral-large-latest', 'open-mistral-7b', 'open-mixtral-8x7b', 'open-mixtral-8x22b'],
  'togetherai': ['deepseek-ai/DeepSeek-V3', 'meta-llama/Meta-Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1', 'mistralai/Mistral-7B-Instruct-v0.3', 'databricks/dbrx-instruct', 'google/gemma-2b-it'],
  'cohere': ['command-a-reasoning-08-2025', 'command-a-03-2025', 'command-r7b-12-2024', 'command-r-08-2024', 'command-r-plus-04-2024', 'command-r-03-2024', 'command-light', 'command-light-nightly', 'command', 'command-nightly', 'command-r', 'command-r-plus'],
  'fireworks': ['accounts/fireworks/models/kimi-k2-instruct', 'accounts/fireworks/models/deepseek-r1', 'accounts/fireworks/models/deepseek-v3', 'accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p2-3b-instruct', 'accounts/fireworks/models/llama-v3p2-11b-vision-instruct', 'accounts/fireworks/models/qwq-32b', 'accounts/fireworks/models/qwen-qwq-32b-preview', 'accounts/fireworks/models/qwen2p5-coder-32b-instruct', 'accounts/fireworks/models/qwen2p5-72b-instruct', 'accounts/fireworks/models/qwen2-vl-72b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/llama-v3p1-405b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct-hf', 'accounts/fireworks/models/yi-large', 'accounts/fireworks/models/firefunction-v1'],
  'cerebras': ['qwen-3-235b-a22b-instruct-2507', 'qwen-3-235b-a22b-thinking-2507', 'zai-glm-4.6', 'qwen-3-32b', 'llama-3.3-70b', 'gpt-oss-120b', 'llama3.1-8b'],
  'replicate': ['meta/meta-llama-3.1-70b-instruct', 'meta/meta-llama-3.1-8b-instruct'],
  'perplexity': ['sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'],
  'vercel': ['v0-1.5-md', 'v0-1.5-lg', 'v0-1.0-md'],
  'openrouter': ['x-ai/grok-4-fast:free', 'openai/gpt-4.1-mini'],
  'ollama': ['gemma3:4b', 'llama3.2:3b'],
  'volcengine': ['doubao-seed-1-6-flash-250828', 'doubao-seed-1-6-lite-251015', 'doubao-seed-1-6-251015'],
  'minimax': ['MiniMax-M2', 'MiniMax-M2-Stable'],
} as const

export const NON_API_TRANSLATE_PROVIDERS = ['google-translate', 'microsoft-translate'] as const
export const NON_API_TRANSLATE_PROVIDERS_MAP: Record<typeof NON_API_TRANSLATE_PROVIDERS[number], string> = {
  'google-translate': 'Google Translate',
  'microsoft-translate': 'Microsoft Translator',
}

export const PURE_TRANSLATE_PROVIDERS = ['google-translate', 'microsoft-translate', 'deeplx'] as const

/**
 * Model options configuration.
 * Flat list design: first match wins, more specific patterns should be placed first.
 * Options are matched by model name, not by provider.
 */
export const TRANSLATE_MODEL_OPTIONS: Array<{
  pattern: RegExp
  options: Record<string, JSONValue>
}> = [
  // Gemini - specific patterns first
  {
    pattern: /^gemini-3-.*-preview$/,
    options: { thinkingConfig: { thinkingLevel: 'low', includeThoughts: false } } satisfies GoogleGenerativeAIProviderOptions as Record<string, JSONValue>,
  },
  {
    pattern: /^gemini-2\.5-pro/,
    options: { thinkingConfig: { thinkingBudget: 128, includeThoughts: false } } satisfies GoogleGenerativeAIProviderOptions as Record<string, JSONValue>,
  },
  {
    // Default for all other Gemini models
    pattern: /^gemini-/,
    options: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } satisfies GoogleGenerativeAIProviderOptions as Record<string, JSONValue>,
  },

  // Claude - disable thinking
  {
    pattern: /^claude-/,
    options: { thinking: { type: 'disabled' } } satisfies AnthropicProviderOptions as Record<string, JSONValue>,
  },

  // OpenAI o1/o3 reasoning models - use 'minimal'
  {
    pattern: /^(o1-|o3-)/,
    options: { reasoningEffort: 'minimal' } satisfies OpenAIResponsesProviderOptions as Record<string, JSONValue>,
  },

  // OpenAI gpt-5.x-chat-latest and gpt-5.2-pro - use 'medium'
  {
    pattern: /^gpt-5(\.\d-chat-latest|\.2-pro)/,
    options: { reasoningEffort: 'medium' } satisfies OpenAIResponsesProviderOptions as Record<string, JSONValue>,
  },

  // OpenAI gpt-5-pro - use 'high'
  {
    pattern: /^gpt-5-pro/,
    options: { reasoningEffort: 'high' } satisfies OpenAIResponsesProviderOptions as Record<string, JSONValue>,
  },

  // OpenAI GPT-5.1+ - use 'none' (minimal not supported)
  {
    pattern: /^gpt-5\.\d/,
    options: { reasoningEffort: 'none' } satisfies OpenAIResponsesProviderOptions as Record<string, JSONValue>,
  },

  // OpenAI GPT-5 models (before 5.1) - use 'minimal' (none not supported)
  {
    pattern: /^gpt-5/,
    options: { reasoningEffort: 'minimal' } satisfies OpenAIResponsesProviderOptions as Record<string, JSONValue>,
  },

  // GLM models - disable thinking (compatibility issues)
  {
    pattern: /^GLM-/i,
    options: { thinking: { type: 'disabled' } },
  },
]
