import type { Theme } from '@/components/providers/theme-provider'
import type { AllProviderTypes, APIProviderTypes, ProviderConfig, ProvidersConfig, ReadModels, TranslateLLMModels } from '@/types/config/provider'
import { i18n } from '#i18n'
import customProviderLogo from '@/assets/providers/custom-provider.svg'
import deeplxLogoDark from '@/assets/providers/deeplx-dark.svg'
import deeplxLogoLight from '@/assets/providers/deeplx-light.svg'
import tensdaqLogoColor from '@/assets/providers/tensdaq-color.svg'
import { API_PROVIDER_TYPES, CUSTOM_LLM_PROVIDER_TYPES, NON_API_TRANSLATE_PROVIDERS, NON_API_TRANSLATE_PROVIDERS_MAP, NON_CUSTOM_LLM_PROVIDER_TYPES, PURE_API_PROVIDER_TYPES, PURE_TRANSLATE_PROVIDERS, READ_PROVIDER_TYPES, TRANSLATE_PROVIDER_TYPES } from '@/types/config/provider'
import { omit, pick } from '@/types/utils'
import { getLobeIconsCDNUrlFn } from '../logo'
import { WEBSITE_URL } from './url'

export const DEFAULT_READ_MODELS: ReadModels = {
  'openrouter': {
    model: 'deepseek/deepseek-chat-v3.1:free',
    isCustomModel: false,
    customModel: null,
  },
  'openai-compatible': {
    model: 'use-custom-model',
    isCustomModel: true,
    customModel: null,
  },
  'openai': {
    model: 'gpt-5-mini',
    isCustomModel: false,
    customModel: null,
  },
  'deepseek': {
    model: 'deepseek-chat',
    isCustomModel: false,
    customModel: null,
  },
  'google': {
    model: 'gemini-3-pro-preview',
    isCustomModel: false,
    customModel: null,
  },
  'anthropic': {
    model: 'claude-opus-4-5',
    isCustomModel: false,
    customModel: null,
  },
  'xai': {
    model: 'grok-4',
    isCustomModel: false,
    customModel: null,
  },
  'bedrock': {
    model: 'us.meta.llama4-maverick-17b-instruct-v1:0',
    isCustomModel: false,
    customModel: null,
  },
  'groq': {
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    isCustomModel: false,
    customModel: null,
  },
  'deepinfra': {
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    isCustomModel: false,
    customModel: null,
  },
  'mistral': {
    model: 'magistral-medium-2506',
    isCustomModel: false,
    customModel: null,
  },
  'togetherai': {
    model: 'deepseek-ai/DeepSeek-V3',
    isCustomModel: false,
    customModel: null,
  },
  'cohere': {
    model: 'command-a-reasoning-08-2025',
    isCustomModel: false,
    customModel: null,
  },
  'fireworks': {
    model: 'accounts/fireworks/models/kimi-k2-instruct',
    isCustomModel: false,
    customModel: null,
  },
  'cerebras': {
    model: 'qwen-3-235b-a22b-thinking-2507',
    isCustomModel: false,
    customModel: null,
  },
  'replicate': {
    model: 'meta/meta-llama-3.1-405b-instruct',
    isCustomModel: false,
    customModel: null,
  },
  'perplexity': {
    model: 'sonar-deep-research',
    isCustomModel: false,
    customModel: null,
  },
  'vercel': {
    model: 'v0-1.5-lg',
    isCustomModel: false,
    customModel: null,
  },
  'ollama': {
    model: 'gemma3:27b',
    isCustomModel: false,
    customModel: null,
  },
  'siliconflow': {
    model: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    isCustomModel: true,
    customModel: null,
  },
  'tensdaq': {
    model: 'MiniMax-M2',
    isCustomModel: true,
    customModel: null,
  },
  'ai302': {
    model: 'gpt-4.1-mini',
    isCustomModel: true,
    customModel: null,
  },
  'volcengine': {
    model: 'doubao-seed-1-6-251015',
    isCustomModel: true,
    customModel: null,
  },
}

export const DEFAULT_TRANSLATE_MODELS: TranslateLLMModels = {
  'openrouter': {
    model: 'x-ai/grok-4-fast:free',
    isCustomModel: false,
    customModel: null,
  },
  'openai-compatible': {
    model: 'use-custom-model',
    isCustomModel: true,
    customModel: null,
  },
  'openai': {
    model: 'gpt-5-mini',
    isCustomModel: false,
    customModel: null,
  },
  'deepseek': {
    model: 'deepseek-chat',
    isCustomModel: false,
    customModel: null,
  },
  'google': {
    model: 'gemini-3-pro-preview',
    isCustomModel: false,
    customModel: null,
  },
  'anthropic': {
    model: 'claude-haiku-4-5',
    isCustomModel: false,
    customModel: null,
  },
  'xai': {
    model: 'grok-4-fast-non-reasoning',
    isCustomModel: false,
    customModel: null,
  },
  'bedrock': {
    model: 'us.meta.llama4-scout-17b-instruct-v1:0',
    isCustomModel: false,
    customModel: null,
  },
  'groq': {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    isCustomModel: false,
    customModel: null,
  },
  'deepinfra': {
    model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    isCustomModel: false,
    customModel: null,
  },
  'mistral': {
    model: 'magistral-small-2506',
    isCustomModel: false,
    customModel: null,
  },
  'togetherai': {
    model: 'deepseek-ai/DeepSeek-V3',
    isCustomModel: false,
    customModel: null,
  },
  'cohere': {
    model: 'command-a-reasoning-08-2025',
    isCustomModel: false,
    customModel: null,
  },
  'fireworks': {
    model: 'accounts/fireworks/models/kimi-k2-instruct',
    isCustomModel: false,
    customModel: null,
  },
  'cerebras': {
    model: 'qwen-3-235b-a22b-instruct-2507',
    isCustomModel: false,
    customModel: null,
  },
  'replicate': {
    model: 'meta/meta-llama-3.1-70b-instruct',
    isCustomModel: false,
    customModel: null,
  },
  'perplexity': {
    model: 'sonar',
    isCustomModel: false,
    customModel: null,
  },
  'vercel': {
    model: 'v0-1.5-md',
    isCustomModel: false,
    customModel: null,
  },
  'ollama': {
    model: 'gemma3:4b',
    isCustomModel: false,
    customModel: null,
  },
  'siliconflow': {
    model: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    isCustomModel: true,
    customModel: null,
  },
  'tensdaq': {
    model: 'Qwen3-30B-A3B-Instruct-2507',
    isCustomModel: true,
    customModel: null,
  },
  'ai302': {
    model: 'gpt-4.1-mini',
    isCustomModel: true,
    customModel: null,
  },
  'volcengine': {
    model: 'doubao-seed-1-6-flash-250828',
    isCustomModel: true,
    customModel: null,
  },
}

export const PROVIDER_ITEMS: Record<AllProviderTypes, { logo: (theme: Theme) => string, name: string, website: string }>
  = {
    'microsoft-translate': {
      logo: getLobeIconsCDNUrlFn('microsoft-color'),
      name: NON_API_TRANSLATE_PROVIDERS_MAP['microsoft-translate'],
      website: 'https://translator.microsoft.com',
    },
    'google-translate': {
      logo: getLobeIconsCDNUrlFn('google-color'),
      name: NON_API_TRANSLATE_PROVIDERS_MAP['google-translate'],
      website: 'https://translate.google.com',
    },
    'deeplx': {
      logo: (theme: Theme) => theme === 'light' ? deeplxLogoLight : deeplxLogoDark,
      name: 'DeepLX',
      website: 'https://deeplx.owo.network/',
    },
    'siliconflow': {
      logo: getLobeIconsCDNUrlFn('siliconcloud-color'),
      name: 'SiliconFlow',
      website: 'https://siliconflow.cn/',
    },
    'ai302': {
      logo: getLobeIconsCDNUrlFn('ai302-color'),
      name: '302.AI',
      website: 'https://share.302.ai/8o2r7P',
    },
    'openrouter': {
      logo: getLobeIconsCDNUrlFn('openrouter'),
      name: 'OpenRouter',
      website: 'https://openrouter.ai/',
    },
    'openai-compatible': {
      logo: () => customProviderLogo,
      name: 'Custom Provider',
      website: `${WEBSITE_URL}/tutorial/providers/openai-compatible`,
    },
    'openai': {
      logo: getLobeIconsCDNUrlFn('openai'),
      name: 'OpenAI',
      website: 'https://platform.openai.com',
    },
    'deepseek': {
      logo: getLobeIconsCDNUrlFn('deepseek-color'),
      name: 'DeepSeek',
      website: 'https://platform.deepseek.com',
    },
    'google': {
      logo: getLobeIconsCDNUrlFn('gemini-color'),
      name: 'Gemini',
      website: 'https://aistudio.google.com',
    },
    'anthropic': {
      logo: getLobeIconsCDNUrlFn('anthropic'),
      name: 'Anthropic',
      website: 'https://console.anthropic.com',
    },
    'xai': {
      logo: getLobeIconsCDNUrlFn('grok'),
      name: 'Grok',
      website: 'https://x.ai/api',
    },
    'bedrock': {
      logo: getLobeIconsCDNUrlFn('bedrock-color'),
      name: 'Amazon Bedrock',
      website: 'https://aws.amazon.com/bedrock/',
    },
    'groq': {
      logo: getLobeIconsCDNUrlFn('groq'),
      name: 'Groq',
      website: 'https://groq.com',
    },
    'deepinfra': {
      logo: getLobeIconsCDNUrlFn('deepinfra-color'),
      name: 'DeepInfra',
      website: 'https://deepinfra.com',
    },
    'mistral': {
      logo: getLobeIconsCDNUrlFn('mistral-color'),
      name: 'Mistral AI',
      website: 'https://mistral.ai',
    },
    'togetherai': {
      logo: getLobeIconsCDNUrlFn('together-color'),
      name: 'Together.ai',
      website: 'https://together.ai',
    },
    'cohere': {
      logo: getLobeIconsCDNUrlFn('cohere-color'),
      name: 'Cohere',
      website: 'https://cohere.com',
    },
    'fireworks': {
      logo: getLobeIconsCDNUrlFn('fireworks-color'),
      name: 'Fireworks AI',
      website: 'https://fireworks.ai',
    },
    'cerebras': {
      logo: getLobeIconsCDNUrlFn('cerebras-color'),
      name: 'Cerebras',
      website: 'https://cerebras.ai',
    },
    'replicate': {
      logo: getLobeIconsCDNUrlFn('replicate'),
      name: 'Replicate',
      website: 'https://replicate.com',
    },
    'perplexity': {
      logo: getLobeIconsCDNUrlFn('perplexity-color'),
      name: 'Perplexity',
      website: 'https://perplexity.ai',
    },
    'vercel': {
      logo: getLobeIconsCDNUrlFn('vercel'),
      name: 'Vercel',
      website: 'https://vercel.com',
    },
    'tensdaq': {
      logo: () => tensdaqLogoColor,
      name: 'Tensdaq',
      website: 'https://dashboard.x-aio.com/zh/register?ref=c356c1daba9a4641a18e',
    },
    'ollama': {
      logo: getLobeIconsCDNUrlFn('ollama'),
      name: 'Ollama',
      website: 'https://ollama.ai',
    },
    'volcengine': {
      logo: getLobeIconsCDNUrlFn('volcengine-color'),
      name: 'Volcengine',
      website: 'https://www.volcengine.com/product/doubao',
    },
  }

export const DEFAULT_PROVIDER_CONFIG = {
  'google-translate': {
    id: 'google-translate-default',
    name: PROVIDER_ITEMS['google-translate'].name,
    enabled: true,
    provider: 'google-translate',
  },
  'microsoft-translate': {
    id: 'microsoft-translate-default',
    name: PROVIDER_ITEMS['microsoft-translate'].name,
    enabled: true,
    provider: 'microsoft-translate',
  },
  'siliconflow': {
    id: 'siliconflow-default',
    name: PROVIDER_ITEMS.siliconflow.name,
    description: i18n.t('options.apiProviders.providers.description.siliconflow'),
    enabled: true,
    provider: 'siliconflow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: {
      read: DEFAULT_READ_MODELS.siliconflow,
      translate: DEFAULT_TRANSLATE_MODELS.siliconflow,
    },
  },
  'tensdaq': {
    id: 'tensdaq-default',
    name: PROVIDER_ITEMS.tensdaq.name,
    description: i18n.t('options.apiProviders.providers.description.tensdaq'),
    enabled: true,
    provider: 'tensdaq',
    baseURL: 'https://tensdaq-api.x-aio.com/v1',
    models: {
      read: DEFAULT_READ_MODELS.tensdaq,
      translate: DEFAULT_TRANSLATE_MODELS.tensdaq,
    },
  },
  'ai302': {
    id: 'ai302-default',
    name: PROVIDER_ITEMS.ai302.name,
    description: i18n.t('options.apiProviders.providers.description.ai302'),
    enabled: true,
    provider: 'ai302',
    baseURL: 'https://api.302.ai/v1',
    models: {
      read: DEFAULT_READ_MODELS.ai302,
      translate: DEFAULT_TRANSLATE_MODELS.ai302,
    },
  },
  'openai-compatible': {
    id: 'openai-compatible-default',
    name: PROVIDER_ITEMS['openai-compatible'].name,
    description: i18n.t('options.apiProviders.providers.description.openaiCompatible'),
    enabled: true,
    provider: 'openai-compatible',
    baseURL: 'https://api.example.com/v1',
    models: {
      read: DEFAULT_READ_MODELS['openai-compatible'],
      translate: DEFAULT_TRANSLATE_MODELS['openai-compatible'],
    },
  },
  'openai': {
    id: 'openai-default',
    name: PROVIDER_ITEMS.openai.name,
    description: i18n.t('options.apiProviders.providers.description.openai'),
    enabled: true,
    provider: 'openai',
    models: {
      read: DEFAULT_READ_MODELS.openai,
      translate: DEFAULT_TRANSLATE_MODELS.openai,
    },
  },
  'deepseek': {
    id: 'deepseek-default',
    name: PROVIDER_ITEMS.deepseek.name,
    description: i18n.t('options.apiProviders.providers.description.deepseek'),
    enabled: true,
    provider: 'deepseek',
    models: {
      read: DEFAULT_READ_MODELS.deepseek,
      translate: DEFAULT_TRANSLATE_MODELS.deepseek,
    },
  },
  'google': {
    id: 'google-default',
    name: PROVIDER_ITEMS.google.name,
    description: i18n.t('options.apiProviders.providers.description.google'),
    enabled: true,
    provider: 'google',
    models: {
      read: DEFAULT_READ_MODELS.google,
      translate: DEFAULT_TRANSLATE_MODELS.google,
    },
  },
  'anthropic': {
    id: 'anthropic-default',
    name: PROVIDER_ITEMS.anthropic.name,
    description: i18n.t('options.apiProviders.providers.description.anthropic'),
    enabled: true,
    provider: 'anthropic',
    models: {
      read: DEFAULT_READ_MODELS.anthropic,
      translate: DEFAULT_TRANSLATE_MODELS.anthropic,
    },
  },
  'xai': {
    id: 'xai-default',
    name: PROVIDER_ITEMS.xai.name,
    description: i18n.t('options.apiProviders.providers.description.xai'),
    enabled: true,
    provider: 'xai',
    models: {
      read: DEFAULT_READ_MODELS.xai,
      translate: DEFAULT_TRANSLATE_MODELS.xai,
    },
  },
  'deeplx': {
    id: 'deeplx-default',
    name: PROVIDER_ITEMS.deeplx.name,
    description: i18n.t('options.apiProviders.providers.description.deeplx'),
    enabled: true,
    provider: 'deeplx',
    baseURL: 'https://api.deeplx.org',
  },
  'bedrock': {
    id: 'bedrock-default',
    name: PROVIDER_ITEMS.bedrock.name,
    description: i18n.t('options.apiProviders.providers.description.bedrock'),
    enabled: true,
    provider: 'bedrock',
    models: {
      read: DEFAULT_READ_MODELS.bedrock,
      translate: DEFAULT_TRANSLATE_MODELS.bedrock,
    },
  },
  'groq': {
    id: 'groq-default',
    name: PROVIDER_ITEMS.groq.name,
    description: i18n.t('options.apiProviders.providers.description.groq'),
    enabled: true,
    provider: 'groq',
    models: {
      read: DEFAULT_READ_MODELS.groq,
      translate: DEFAULT_TRANSLATE_MODELS.groq,
    },
  },
  'deepinfra': {
    id: 'deepinfra-default',
    name: PROVIDER_ITEMS.deepinfra.name,
    description: i18n.t('options.apiProviders.providers.description.deepinfra'),
    enabled: true,
    provider: 'deepinfra',
    models: {
      read: DEFAULT_READ_MODELS.deepinfra,
      translate: DEFAULT_TRANSLATE_MODELS.deepinfra,
    },
  },
  'mistral': {
    id: 'mistral-default',
    name: PROVIDER_ITEMS.mistral.name,
    description: i18n.t('options.apiProviders.providers.description.mistral'),
    enabled: true,
    provider: 'mistral',
    models: {
      read: DEFAULT_READ_MODELS.mistral,
      translate: DEFAULT_TRANSLATE_MODELS.mistral,
    },
  },
  'togetherai': {
    id: 'togetherai-default',
    name: PROVIDER_ITEMS.togetherai.name,
    description: i18n.t('options.apiProviders.providers.description.togetherai'),
    enabled: true,
    provider: 'togetherai',
    models: {
      read: DEFAULT_READ_MODELS.togetherai,
      translate: DEFAULT_TRANSLATE_MODELS.togetherai,
    },
  },
  'cohere': {
    id: 'cohere-default',
    name: PROVIDER_ITEMS.cohere.name,
    description: i18n.t('options.apiProviders.providers.description.cohere'),
    enabled: true,
    provider: 'cohere',
    models: {
      read: DEFAULT_READ_MODELS.cohere,
      translate: DEFAULT_TRANSLATE_MODELS.cohere,
    },
  },
  'fireworks': {
    id: 'fireworks-default',
    name: PROVIDER_ITEMS.fireworks.name,
    description: i18n.t('options.apiProviders.providers.description.fireworks'),
    enabled: true,
    provider: 'fireworks',
    models: {
      read: DEFAULT_READ_MODELS.fireworks,
      translate: DEFAULT_TRANSLATE_MODELS.fireworks,
    },
  },
  'cerebras': {
    id: 'cerebras-default',
    name: PROVIDER_ITEMS.cerebras.name,
    description: i18n.t('options.apiProviders.providers.description.cerebras'),
    enabled: true,
    provider: 'cerebras',
    models: {
      read: DEFAULT_READ_MODELS.cerebras,
      translate: DEFAULT_TRANSLATE_MODELS.cerebras,
    },
  },
  'replicate': {
    id: 'replicate-default',
    name: PROVIDER_ITEMS.replicate.name,
    description: i18n.t('options.apiProviders.providers.description.replicate'),
    enabled: true,
    provider: 'replicate',
    models: {
      read: DEFAULT_READ_MODELS.replicate,
      translate: DEFAULT_TRANSLATE_MODELS.replicate,
    },
  },
  'perplexity': {
    id: 'perplexity-default',
    name: PROVIDER_ITEMS.perplexity.name,
    description: i18n.t('options.apiProviders.providers.description.perplexity'),
    enabled: true,
    provider: 'perplexity',
    models: {
      read: DEFAULT_READ_MODELS.perplexity,
      translate: DEFAULT_TRANSLATE_MODELS.perplexity,
    },
  },
  'vercel': {
    id: 'vercel-default',
    name: PROVIDER_ITEMS.vercel.name,
    description: i18n.t('options.apiProviders.providers.description.vercel'),
    enabled: true,
    provider: 'vercel',
    models: {
      read: DEFAULT_READ_MODELS.vercel,
      translate: DEFAULT_TRANSLATE_MODELS.vercel,
    },
  },
  'openrouter': {
    id: 'openrouter-default',
    name: PROVIDER_ITEMS.openrouter.name,
    description: i18n.t('options.apiProviders.providers.description.openrouter'),
    enabled: true,
    provider: 'openrouter',
    models: {
      read: DEFAULT_READ_MODELS.openrouter,
      translate: DEFAULT_TRANSLATE_MODELS.openrouter,
    },
  },
  'ollama': {
    id: 'ollama-default',
    name: PROVIDER_ITEMS.ollama.name,
    description: i18n.t('options.apiProviders.providers.description.ollama'),
    enabled: true,
    provider: 'ollama',
    models: {
      read: DEFAULT_READ_MODELS.ollama,
      translate: DEFAULT_TRANSLATE_MODELS.ollama,
    },
  },
  'volcengine': {
    id: 'volcengine-default',
    name: PROVIDER_ITEMS.volcengine.name,
    description: i18n.t('options.apiProviders.providers.description.volcengine'),
    enabled: true,
    provider: 'volcengine',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    models: {
      read: DEFAULT_READ_MODELS.volcengine,
      translate: DEFAULT_TRANSLATE_MODELS.volcengine,
    },
  },
} as const satisfies Record<AllProviderTypes, ProviderConfig>

export const DEFAULT_PROVIDER_CONFIG_LIST: ProvidersConfig = [
  DEFAULT_PROVIDER_CONFIG['google-translate'],
  DEFAULT_PROVIDER_CONFIG['microsoft-translate'],
  DEFAULT_PROVIDER_CONFIG.openai,
  DEFAULT_PROVIDER_CONFIG.tensdaq,
  DEFAULT_PROVIDER_CONFIG.ai302,
  // DEFAULT_PROVIDER_CONFIG.deepseek,
  DEFAULT_PROVIDER_CONFIG.google,
  // DEFAULT_PROVIDER_CONFIG.openaiCompatible,
  DEFAULT_PROVIDER_CONFIG.deeplx,
  // DEFAULT_PROVIDER_CONFIG.anthropic,
  // DEFAULT_PROVIDER_CONFIG.xai,
  // DEFAULT_PROVIDER_CONFIG.bedrock,
  // DEFAULT_PROVIDER_CONFIG.groq,
  // DEFAULT_PROVIDER_CONFIG.deepinfra,
  // DEFAULT_PROVIDER_CONFIG.mistral,
  // DEFAULT_PROVIDER_CONFIG.togetherai,
  // DEFAULT_PROVIDER_CONFIG.cohere,
  // DEFAULT_PROVIDER_CONFIG.fireworks,
  // DEFAULT_PROVIDER_CONFIG.cerebras,
  // DEFAULT_PROVIDER_CONFIG.replicate,
  // DEFAULT_PROVIDER_CONFIG.perplexity,
  // DEFAULT_PROVIDER_CONFIG.vercel,
]

export const NON_API_TRANSLATE_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  NON_API_TRANSLATE_PROVIDERS,
)

export const TRANSLATE_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  TRANSLATE_PROVIDER_TYPES,
)

export const PURE_TRANSLATE_PROVIDER_ITEMS = pick(
  TRANSLATE_PROVIDER_ITEMS,
  PURE_TRANSLATE_PROVIDERS,
)

export const LLM_TRANSLATE_PROVIDER_ITEMS = omit(
  TRANSLATE_PROVIDER_ITEMS,
  PURE_TRANSLATE_PROVIDERS,
)

export const READ_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  READ_PROVIDER_TYPES,
)

export const API_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  API_PROVIDER_TYPES,
)

export const PROVIDER_GROUPS = {
  builtInProviders: {
    types: NON_CUSTOM_LLM_PROVIDER_TYPES,
    tutorialSlug: 'built-in-providers',
  },
  openaiCompatibleProviders: {
    types: CUSTOM_LLM_PROVIDER_TYPES,
    tutorialSlug: 'openai-compatible-providers',
  },
  pureTranslationProviders: {
    types: PURE_API_PROVIDER_TYPES,
    tutorialSlug: 'pure-translation-providers',
  },
} as const satisfies Record<string, { types: readonly APIProviderTypes[], tutorialSlug: string }>

export const SPECIFIC_TUTORIAL_PROVIDER_TYPES = ['ollama', 'deeplx'] as const satisfies readonly APIProviderTypes[]
