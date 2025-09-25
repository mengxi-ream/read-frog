import type { AllProviderNames, ProviderConfig, ProvidersConfig, ReadModels, TranslateLLMModels } from '@/types/config/provider'
import { i18n } from '#i18n'
import customProviderLogo from '@/assets/providers/custom-provider.svg'
import deeplxLogoDark from '@/assets/providers/deeplx-dark.svg'
import deeplxLogoLight from '@/assets/providers/deeplx-light.svg'
import tensdaqLogoColor from '@/assets/providers/tensdaq-color.svg'
import { API_PROVIDER_NAMES, NON_API_TRANSLATE_PROVIDERS, NON_API_TRANSLATE_PROVIDERS_MAP, PURE_TRANSLATE_PROVIDERS, READ_PROVIDER_NAMES, TRANSLATE_PROVIDER_NAMES } from '@/types/config/provider'
import { omit, pick } from '@/types/utils'
import { getLobeIconsCDNUrlFn } from '../logo'

export const DEFAULT_READ_MODELS: ReadModels = {
  siliconflow: {
    model: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    isCustomModel: false,
    customModel: null,
  },
  tensdaq: {
    model: 'Qwen3-235B-A22B-Instruct-2507',
    isCustomModel: false,
    customModel: null,
  },
  ai302: {
    model: 'gpt-4.1-mini',
    isCustomModel: false,
    customModel: null,
  },
  openrouter: {
    model: 'deepseek/deepseek-chat-v3.1:free',
    isCustomModel: false,
    customModel: null,
  },
  openaiCompatible: {
    model: 'use-custom-model',
    isCustomModel: true,
    customModel: null,
  },
  openai: {
    model: 'gpt-4.1-mini',
    isCustomModel: false,
    customModel: null,
  },
  deepseek: {
    model: 'deepseek-chat',
    isCustomModel: false,
    customModel: null,
  },
  gemini: {
    model: 'gemini-2.5-pro',
    isCustomModel: false,
    customModel: null,
  },
  anthropic: {
    model: 'claude-3-5-sonnet-20241022',
    isCustomModel: false,
    customModel: null,
  },
  grok: {
    model: 'grok-4',
    isCustomModel: false,
    customModel: null,
  },
  amazonBedrock: {
    model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    isCustomModel: false,
    customModel: null,
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    isCustomModel: false,
    customModel: null,
  },
  deepinfra: {
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    isCustomModel: false,
    customModel: null,
  },
  mistral: {
    model: 'mistral-large-latest',
    isCustomModel: false,
    customModel: null,
  },
  togetherai: {
    model: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    isCustomModel: false,
    customModel: null,
  },
  cohere: {
    model: 'command-r-plus',
    isCustomModel: false,
    customModel: null,
  },
  fireworks: {
    model: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
    isCustomModel: false,
    customModel: null,
  },
  cerebras: {
    model: 'llama-3.3-70b',
    isCustomModel: false,
    customModel: null,
  },
  replicate: {
    model: 'meta/meta-llama-3.1-405b-instruct',
    isCustomModel: false,
    customModel: null,
  },
  perplexity: {
    model: 'sonar-pro',
    isCustomModel: false,
    customModel: null,
  },
  vercel: {
    model: 'v0-1.5-md',
    isCustomModel: false,
    customModel: null,
  },
  ollama: {
    model: 'deepseek-v3',
    isCustomModel: false,
    customModel: null,
  },
}

export const DEFAULT_TRANSLATE_MODELS: TranslateLLMModels = {
  siliconflow: {
    model: 'Qwen/Qwen3-Next-80B-A3B-Instruct',
    isCustomModel: false,
    customModel: null,
  },
  tensdaq: {
    model: 'Qwen3-30B-A3B-Instruct-2507',
    isCustomModel: false,
    customModel: null,
  },
  ai302: {
    model: 'gpt-4.1-mini',
    isCustomModel: false,
    customModel: null,
  },
  openrouter: {
    model: 'x-ai/grok-4-fast:free',
    isCustomModel: false,
    customModel: null,
  },
  openaiCompatible: {
    model: 'use-custom-model',
    isCustomModel: true,
    customModel: null,
  },
  openai: {
    model: 'gpt-4.1-mini',
    isCustomModel: false,
    customModel: null,
  },
  deepseek: {
    model: 'deepseek-chat',
    isCustomModel: false,
    customModel: null,
  },
  gemini: {
    model: 'gemini-1.5-flash',
    isCustomModel: false,
    customModel: null,
  },
  anthropic: {
    model: 'claude-3-5-haiku-20241022',
    isCustomModel: false,
    customModel: null,
  },
  grok: {
    model: 'grok-3-mini',
    isCustomModel: false,
    customModel: null,
  },
  amazonBedrock: {
    model: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    isCustomModel: false,
    customModel: null,
  },
  groq: {
    model: 'llama-3.1-70b-versatile',
    isCustomModel: false,
    customModel: null,
  },
  deepinfra: {
    model: 'meta-llama/Llama-3.1-70B-Instruct',
    isCustomModel: false,
    customModel: null,
  },
  mistral: {
    model: 'mistral-small-latest',
    isCustomModel: false,
    customModel: null,
  },
  togetherai: {
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    isCustomModel: false,
    customModel: null,
  },
  cohere: {
    model: 'command-r',
    isCustomModel: false,
    customModel: null,
  },
  fireworks: {
    model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    isCustomModel: false,
    customModel: null,
  },
  cerebras: {
    model: 'llama3.1-8b',
    isCustomModel: false,
    customModel: null,
  },
  replicate: {
    model: 'meta/meta-llama-3.1-70b-instruct',
    isCustomModel: false,
    customModel: null,
  },
  perplexity: {
    model: 'sonar-pro',
    isCustomModel: false,
    customModel: null,
  },
  vercel: {
    model: 'v0-1.5-md',
    isCustomModel: false,
    customModel: null,
  },
  ollama: {
    model: 'gemma3:4b',
    isCustomModel: false,
    customModel: null,
  },
}

export const PROVIDER_ITEMS: Record<AllProviderNames, { logo: (isDark: boolean) => string, name: string }>
  = {
    microsoft: {
      logo: getLobeIconsCDNUrlFn('microsoft-color'),
      name: NON_API_TRANSLATE_PROVIDERS_MAP.microsoft,
    },
    google: {
      logo: getLobeIconsCDNUrlFn('google-color'),
      name: NON_API_TRANSLATE_PROVIDERS_MAP.google,
    },
    deeplx: {
      logo: (isDark: boolean) => isDark ? deeplxLogoDark : deeplxLogoLight,
      name: 'DeepLX',
    },
    siliconflow: {
      logo: getLobeIconsCDNUrlFn('siliconcloud-color'),
      name: 'SiliconFlow',
    },
    ai302: {
      logo: getLobeIconsCDNUrlFn('ai302-color'),
      name: '302.AI',
    },
    openrouter: {
      logo: getLobeIconsCDNUrlFn('openrouter'),
      name: 'OpenRouter',
    },
    openaiCompatible: {
      logo: () => customProviderLogo,
      name: 'Custom Provider',
    },
    openai: {
      logo: getLobeIconsCDNUrlFn('openai'),
      name: 'OpenAI',
    },
    deepseek: {
      logo: getLobeIconsCDNUrlFn('deepseek-color'),
      name: 'DeepSeek',
    },
    gemini: {
      logo: getLobeIconsCDNUrlFn('gemini-color'),
      name: 'Gemini',
    },
    anthropic: {
      logo: getLobeIconsCDNUrlFn('anthropic'),
      name: 'Anthropic',
    },
    grok: {
      logo: getLobeIconsCDNUrlFn('grok'),
      name: 'Grok',
    },
    amazonBedrock: {
      logo: getLobeIconsCDNUrlFn('bedrock-color'),
      name: 'Amazon Bedrock',
    },
    groq: {
      logo: getLobeIconsCDNUrlFn('groq'),
      name: 'Groq',
    },
    deepinfra: {
      logo: getLobeIconsCDNUrlFn('deepinfra-color'),
      name: 'DeepInfra',
    },
    mistral: {
      logo: getLobeIconsCDNUrlFn('mistral-color'),
      name: 'Mistral AI',
    },
    togetherai: {
      logo: getLobeIconsCDNUrlFn('together-color'),
      name: 'Together.ai',
    },
    cohere: {
      logo: getLobeIconsCDNUrlFn('cohere-color'),
      name: 'Cohere',
    },
    fireworks: {
      logo: getLobeIconsCDNUrlFn('fireworks-color'),
      name: 'Fireworks AI',
    },
    cerebras: {
      logo: getLobeIconsCDNUrlFn('cerebras-color'),
      name: 'Cerebras',
    },
    replicate: {
      logo: getLobeIconsCDNUrlFn('replicate'),
      name: 'Replicate',
    },
    perplexity: {
      logo: getLobeIconsCDNUrlFn('perplexity-color'),
      name: 'Perplexity',
    },
    vercel: {
      logo: getLobeIconsCDNUrlFn('vercel'),
      name: 'Vercel',
    },
    tensdaq: {
      logo: () => tensdaqLogoColor,
      name: 'Tensdaq',
    },
    ollama: {
      logo: getLobeIconsCDNUrlFn('ollama'),
      name: 'Ollama',
    },
  }

export const DEFAULT_PROVIDER_CONFIG = {
  google: {
    id: 'google-default',
    name: PROVIDER_ITEMS.google.name,
    enabled: true,
    provider: 'google',
  },
  microsoft: {
    id: 'microsoft-default',
    name: PROVIDER_ITEMS.microsoft.name,
    enabled: true,
    provider: 'microsoft',
  },
  siliconflow: {
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
  tensdaq: {
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
  ai302: {
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
  openaiCompatible: {
    id: 'openai-compatible-default',
    name: PROVIDER_ITEMS.openaiCompatible.name,
    description: i18n.t('options.apiProviders.providers.description.openaiCompatible'),
    enabled: true,
    provider: 'openaiCompatible',
    baseURL: 'https://api.example.com/v1',
    models: {
      read: DEFAULT_READ_MODELS.openaiCompatible,
      translate: DEFAULT_TRANSLATE_MODELS.openaiCompatible,
    },
  },
  openai: {
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
  deepseek: {
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
  gemini: {
    id: 'gemini-default',
    name: PROVIDER_ITEMS.gemini.name,
    description: i18n.t('options.apiProviders.providers.description.gemini'),
    enabled: true,
    provider: 'gemini',
    models: {
      read: DEFAULT_READ_MODELS.gemini,
      translate: DEFAULT_TRANSLATE_MODELS.gemini,
    },
  },
  anthropic: {
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
  grok: {
    id: 'xai-default',
    name: PROVIDER_ITEMS.grok.name,
    description: i18n.t('options.apiProviders.providers.description.xai'),
    enabled: true,
    provider: 'grok',
    models: {
      read: DEFAULT_READ_MODELS.grok,
      translate: DEFAULT_TRANSLATE_MODELS.grok,
    },
  },
  deeplx: {
    id: 'deeplx-default',
    name: PROVIDER_ITEMS.deeplx.name,
    description: i18n.t('options.apiProviders.providers.description.deeplx'),
    enabled: true,
    provider: 'deeplx',
    baseURL: 'https://deeplx.vercel.app',
  },
  amazonBedrock: {
    id: 'amazon-bedrock-default',
    name: PROVIDER_ITEMS.amazonBedrock.name,
    description: i18n.t('options.apiProviders.providers.description.amazonBedrock'),
    enabled: true,
    provider: 'amazonBedrock',
    models: {
      read: DEFAULT_READ_MODELS.amazonBedrock,
      translate: DEFAULT_TRANSLATE_MODELS.amazonBedrock,
    },
  },
  groq: {
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
  deepinfra: {
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
  mistral: {
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
  togetherai: {
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
  cohere: {
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
  fireworks: {
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
  cerebras: {
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
  replicate: {
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
  perplexity: {
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
  vercel: {
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
  openrouter: {
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
  ollama: {
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
} as const satisfies Record<AllProviderNames, ProviderConfig>

export const DEFAULT_PROVIDER_CONFIG_LIST: ProvidersConfig = [
  DEFAULT_PROVIDER_CONFIG.google,
  DEFAULT_PROVIDER_CONFIG.microsoft,
  DEFAULT_PROVIDER_CONFIG.openai,
  DEFAULT_PROVIDER_CONFIG.ai302,
  DEFAULT_PROVIDER_CONFIG.deepseek,
  DEFAULT_PROVIDER_CONFIG.gemini,
  // DEFAULT_PROVIDER_CONFIG.openaiCompatible,
  DEFAULT_PROVIDER_CONFIG.deeplx,
  // DEFAULT_PROVIDER_CONFIG.anthropic,
  // DEFAULT_PROVIDER_CONFIG.grok,
  // DEFAULT_PROVIDER_CONFIG.amazonBedrock,
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
  TRANSLATE_PROVIDER_NAMES,
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
  READ_PROVIDER_NAMES,
)

export const API_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  API_PROVIDER_NAMES,
)
