import type { Config } from '@/types/config/config'
import type { AllProviderNames, PageTranslateRange, ProvidersConfig, ReadModels, TranslateModels } from '@/types/config/provider'
import deepseekLogo from '@/assets/providers/deepseek.png'
import geminiLogo from '@/assets/providers/gemini.png'
import googleLogo from '@/assets/providers/google.png'
import microsoftLogo from '@/assets/providers/microsoft.png'
import openaiLogo from '@/assets/providers/openai.jpg'
import { apiProviderNames, pureTranslateProvider, readProviderNames, translateProviderNames } from '@/types/config/provider'
import { omit, pick } from '@/types/utils'
import { DEFAULT_TRANSLATE_PROMPTS_CONFIG } from './prompt'
import { DEFAULT_SIDE_CONTENT_WIDTH } from './side'
import { DEFAULT_REQUEST_CAPACITY, DEFAULT_REQUEST_RATE } from './translate'

export const CONFIG_STORAGE_KEY = 'config'
export const CONFIG_SCHEMA_VERSION = 11

export const DEFAULT_PROVIDER_CONFIG: ProvidersConfig = {
  openai: {
    apiKey: undefined,
    baseURL: 'https://api.openai.com/v1',
  },
  deepseek: {
    apiKey: undefined,
    baseURL: 'https://api.deepseek.com/v1',
  },
  gemini: {
    apiKey: undefined,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  },
}

export const DEFAULT_READ_MODELS: ReadModels = {
  openai: {
    model: 'gpt-4.1-mini',
    isCustomModel: false,
    customModel: '',
  },
  deepseek: {
    model: 'deepseek-chat',
    isCustomModel: false,
    customModel: '',
  },
}

export const DEFAULT_TRANSLATE_MODELS: TranslateModels = {
  microsoft: null,
  google: null,
  openai: {
    model: 'gpt-4.1-mini',
    isCustomModel: false,
    customModel: '',
  },
  deepseek: {
    model: 'deepseek-chat',
    isCustomModel: false,
    customModel: '',
  },
  gemini: {
    model: 'gemini-2.5-pro',
    isCustomModel: false,
    customModel: '',
  },
}

export const DEFAULT_CONFIG: Config = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'eng',
    level: 'intermediate',
  },
  providersConfig: DEFAULT_PROVIDER_CONFIG,
  read: {
    provider: 'openai',
    models: DEFAULT_READ_MODELS,
  },
  translate: {
    provider: 'microsoft',
    models: DEFAULT_TRANSLATE_MODELS,
    node: {
      enabled: true,
      hotkey: 'Control',
    },
    page: {
      range: 'main',
      autoTranslatePatterns: ['news.ycombinator.com'],
    },
    promptsConfig: DEFAULT_TRANSLATE_PROMPTS_CONFIG,
    requestQueueConfig: {
      capacity: DEFAULT_REQUEST_CAPACITY,
      rate: DEFAULT_REQUEST_RATE,
    },
  },
  floatingButton: {
    enabled: true,
    position: 0.66,
  },
  sideContent: {
    width: DEFAULT_SIDE_CONTENT_WIDTH,
  },
}

export const PROVIDER_ITEMS: Record<AllProviderNames, { logo: string, name: string }>
  = {
    microsoft: {
      logo: microsoftLogo,
      name: 'Microsoft Translator',
    },
    google: {
      logo: googleLogo,
      name: 'Google Translate',
    },
    openai: {
      logo: openaiLogo,
      name: 'OpenAI',
    },
    deepseek: {
      logo: deepseekLogo,
      name: 'DeepSeek',
    },
    gemini: {
      logo: geminiLogo,
      name: 'Gemini',
    },
  }

export const TRANSLATE_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  translateProviderNames,
)

export const PURE_TRANSLATE_PROVIDER_ITEMS = pick(
  TRANSLATE_PROVIDER_ITEMS,
  pureTranslateProvider,
)

export const LLM_TRANSLATE_PROVIDER_ITEMS = omit(
  TRANSLATE_PROVIDER_ITEMS,
  pureTranslateProvider,
)

export const READ_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  readProviderNames,
)

export const API_PROVIDER_ITEMS = pick(
  PROVIDER_ITEMS,
  apiProviderNames,
)

export const PAGE_TRANSLATE_RANGE_ITEMS: Record<
  PageTranslateRange,
  { label: string }
> = {
  main: { label: 'Main' },
  all: { label: 'All' },
}
