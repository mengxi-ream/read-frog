import type { Config } from '@/types/config/config'
import type { AllProviderNames, PageTranslateRange, ProvidersConfig, ReadModels, TranslateModels } from '@/types/config/provider'
import deeplxLogo from '@/assets/providers/deeplx.png'
import deepseekLogo from '@/assets/providers/deepseek.png'
import geminiLogo from '@/assets/providers/gemini.png'
import googleLogo from '@/assets/providers/google.png'
import microsoftLogo from '@/assets/providers/microsoft.png'
import openaiLogo from '@/assets/providers/openai.jpg'
import { API_PROVIDER_NAMES, PURE_TRANSLATE_PROVIDERS, READ_PROVIDER_NAMES, TRANSLATE_PROVIDER_NAMES } from '@/types/config/provider'
import { omit, pick } from '@/types/utils'
import { DEFAULT_TRANSLATE_PROMPTS_CONFIG } from './prompt'
import { DEFAULT_SIDE_CONTENT_WIDTH } from './side'
import { DEFAULT_REQUEST_CAPACITY, DEFAULT_REQUEST_RATE } from './translate'
import { DEFAULT_TRANSLATION_NODE_STYLE } from './translation-node-style'

export const CONFIG_STORAGE_KEY = 'config'
export const CONFIG_SCHEMA_VERSION = 15

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
  deeplx: {
    apiKey: undefined,
    baseURL: 'https://deeplx.vercel.app',
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
  gemini: {
    model: 'gemini-2.5-pro',
    isCustomModel: false,
    customModel: '',
  },
}

export const DEFAULT_TRANSLATE_MODELS: TranslateModels = {
  microsoft: null,
  google: null,
  deeplx: null,
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
    model: 'gemini-1.5-flash',
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
    translationNodeStyle: DEFAULT_TRANSLATION_NODE_STYLE,
  },
  floatingButton: {
    enabled: true,
    position: 0.66,
  },
  selectionToolbar: {
    enabled: true,
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
    deeplx: {
      logo: deeplxLogo,
      name: 'DeepLX',
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

export const PAGE_TRANSLATE_RANGE_ITEMS: Record<
  PageTranslateRange,
  { label: string }
> = {
  main: { label: 'Main' },
  all: { label: 'All' },
}
