import type { Config } from '@/types/config/config'
import type { PageTranslateRange } from '@/types/config/translate'
import { DEFAULT_TRANSLATE_PROMPTS_CONFIG } from './prompt'
import { DEFAULT_PROVIDER_CONFIG_LIST } from './providers'
import { DEFAULT_SIDE_CONTENT_WIDTH } from './side'
import { DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY, DEFAULT_BATCH_CONFIG, DEFAULT_REQUEST_CAPACITY, DEFAULT_REQUEST_RATE } from './translate'
import { DEFAULT_TRANSLATION_NODE_STYLE } from './translation-node-style'

export const CONFIG_STORAGE_KEY = 'config'
export const CONFIG_SCHEMA_VERSION = 25

export const DEFAULT_FLOATING_BUTTON_POSITION = 0.66

export const DEFAULT_CONFIG: Config = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'cmn',
    level: 'intermediate',
  },
  providersConfig: DEFAULT_PROVIDER_CONFIG_LIST,
  read: {
    providerId: 'openai-default',
  },
  translate: {
    providerId: 'microsoft-default',
    mode: 'bilingual',
    node: {
      enabled: true,
      hotkey: 'Shift',
    },
    page: {
      range: 'main',
      autoTranslatePatterns: ['news.ycombinator.com'],
      autoTranslateLanguages: [],
    },
    promptsConfig: DEFAULT_TRANSLATE_PROMPTS_CONFIG,
    requestQueueConfig: {
      capacity: DEFAULT_REQUEST_CAPACITY,
      rate: DEFAULT_REQUEST_RATE,
    },
    batchQueueConfig: {
      maxCharactersPerBatch: DEFAULT_BATCH_CONFIG.maxCharactersPerBatch,
      maxItemsPerBatch: DEFAULT_BATCH_CONFIG.maxItemsPerBatch,
    },
    translationNodeStyle: DEFAULT_TRANSLATION_NODE_STYLE,
    customAutoTranslateShortcutKey: DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY,
  },
  floatingButton: {
    enabled: true,
    position: DEFAULT_FLOATING_BUTTON_POSITION,
    disabledFloatingButtonPatterns: [],
  },
  selectionToolbar: {
    enabled: true,
  },
  sideContent: {
    width: DEFAULT_SIDE_CONTENT_WIDTH,
  },
  betaExperience: {
    enabled: false,
  },
}

export const PAGE_TRANSLATE_RANGE_ITEMS: Record<
  PageTranslateRange,
  { label: string }
> = {
  main: { label: 'Main' },
  all: { label: 'All' },
}
