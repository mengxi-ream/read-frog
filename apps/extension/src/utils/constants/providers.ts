import type { AllProviderNames, ProviderConfig, ProvidersConfig, ReadModels, TranslateLLMModels } from '@/types/config/provider'
import { i18n } from '#i18n'
import deeplxLogoDark from '@/assets/providers/deeplx-dark.svg'
import deeplxLogoLight from '@/assets/providers/deeplx-light.svg'
import openaiCompatibleLogoDark from '@/assets/providers/openai-compatible-dark.svg'
import openaiCompatibleLogoLight from '@/assets/providers/openai-compatible-light.svg'
import { API_PROVIDER_NAMES, NON_API_TRANSLATE_PROVIDERS, NON_API_TRANSLATE_PROVIDERS_MAP, PURE_TRANSLATE_PROVIDERS, READ_PROVIDER_NAMES, TRANSLATE_PROVIDER_NAMES } from '@/types/config/provider'
import { omit, pick } from '@/types/utils'
import { getLobeIconsCDNUrlFn } from '../logo'

export const DEFAULT_READ_MODELS: ReadModels = {
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
  openaiCompatible: {
    model: 'use-custom-model',
    isCustomModel: true,
    customModel: null,
  },
}

export const DEFAULT_TRANSLATE_MODELS: TranslateLLMModels = {
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
  openaiCompatible: {
    model: 'use-custom-model',
    isCustomModel: true,
    customModel: null,
  },
}

export const DEFAULT_PROVIDER_CONFIG = {
  google: {
    id: 'google-default',
    name: 'Google Translate',
    enabled: true,
    provider: 'google',
  },
  microsoft: {
    id: 'microsoft-default',
    name: 'Microsoft Translator',
    enabled: true,
    provider: 'microsoft',
  },
  openai: {
    id: 'openai-default',
    name: 'OpenAI',
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
    name: 'DeepSeek',
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
    name: 'Gemini',
    description: i18n.t('options.apiProviders.providers.description.gemini'),
    enabled: true,
    provider: 'gemini',
    models: {
      read: DEFAULT_READ_MODELS.gemini,
      translate: DEFAULT_TRANSLATE_MODELS.gemini,
    },
  },
  openaiCompatible: {
    id: 'openai-compatible-default',
    name: 'OpenAI Compatible',
    description: i18n.t('options.apiProviders.providers.description.openaiCompatible'),
    enabled: true,
    provider: 'openaiCompatible',
    baseURL: 'https://api.example.com/v1',
    models: {
      read: DEFAULT_READ_MODELS.openaiCompatible,
      translate: DEFAULT_TRANSLATE_MODELS.openaiCompatible,
    },
  },
  deeplx: {
    id: 'deeplx-default',
    name: 'DeepLX',
    description: i18n.t('options.apiProviders.providers.description.deeplx'),
    enabled: true,
    provider: 'deeplx',
    baseURL: 'https://deeplx.vercel.app',
  },
} as const satisfies Record<AllProviderNames, ProviderConfig>

export const DEFAULT_PROVIDER_CONFIG_LIST: ProvidersConfig = [
  DEFAULT_PROVIDER_CONFIG.google,
  DEFAULT_PROVIDER_CONFIG.microsoft,
  DEFAULT_PROVIDER_CONFIG.openai,
  DEFAULT_PROVIDER_CONFIG.deepseek,
  DEFAULT_PROVIDER_CONFIG.gemini,
  // DEFAULT_PROVIDER_CONFIG.openaiCompatible,
  DEFAULT_PROVIDER_CONFIG.deeplx,
]

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
    openaiCompatible: {
      logo: (isDark: boolean) => isDark ? openaiCompatibleLogoDark : openaiCompatibleLogoLight,
      name: 'OpenAI Compatible',
    },
  }

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
