import type { Config, Hotkey, PageTranslateRange } from '@/types/config/config'
import type { Provider, ProvidersConfig } from '@/types/config/provider'
import deepseekLogo from '@/assets/llm/deepseek.png'
import openaiLogo from '@/assets/llm/openai.jpg'

export const CONFIG_STORAGE_KEY = 'config'
export const CONFIG_SCHEMA_VERSION = 3

export const HOTKEYS = ['Control', 'Alt', 'Shift', '`'] as const
export const HOTKEY_ITEMS: Record<Hotkey, { label: string, icon: string }> = {
  'Control': { label: 'Ctrl', icon: '⌃' },
  'Alt': { label: 'Option', icon: '⌥' },
  'Shift': { label: 'Shift', icon: '⇧' },
  '`': { label: 'Backtick', icon: '`' },
}

export const MIN_SIDE_CONTENT_WIDTH = 400 // px
export const DEFAULT_SIDE_CONTENT_WIDTH = 400 // px

export const DEFAULT_PROVIDER_CONFIG: ProvidersConfig = {
  openai: {
    apiKey: undefined,
    model: 'gpt-4.1-mini',
    isCustomModel: false,
    customModel: '',
  },
  deepseek: {
    apiKey: undefined,
    model: 'deepseek-chat',
    isCustomModel: false,
    customModel: '',
  },
}

export const DEFAULT_CONFIG: Config = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'cmn',
    level: 'intermediate',
  },
  provider: 'openai',
  providersConfig: DEFAULT_PROVIDER_CONFIG,
  translate: {
    provider: 'microsoft',
    node: {
      enabled: true,
      hotkey: 'Control',
    },
    page: {
      range: 'main',
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

export const PROVIDER_ITEMS: Record<Provider, { logo: string, name: string }>
  = {
    openai: {
      logo: openaiLogo,
      name: 'OpenAI',
    },
    deepseek: {
      logo: deepseekLogo,
      name: 'DeepSeek',
    },
  }

export const PAGE_TRANSLATE_RANGE_ITEMS: Record<
  PageTranslateRange,
  { label: string }
> = {
  main: { label: 'Main' },
  all: { label: 'All' },
}
