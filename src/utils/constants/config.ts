import type { Config } from '@/types/config/config'
import type { PageTranslateRange } from '@/types/config/translate'
import { DEFAULT_TRANSLATE_PROMPTS_CONFIG } from './prompt'
import { DEFAULT_PROVIDER_CONFIG_LIST } from './providers'
import { DEFAULT_SIDE_CONTENT_WIDTH } from './side'
import { DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY, DEFAULT_BATCH_CONFIG, DEFAULT_PRELOAD_MARGIN, DEFAULT_PRELOAD_THRESHOLD, DEFAULT_REQUEST_CAPACITY, DEFAULT_REQUEST_RATE } from './translate'
import { TRANSLATION_NODE_STYLE_ON_INSTALLED } from './translation-node-style'
import { DEFAULT_TTS_CONFIG } from './tts'

export const CONFIG_STORAGE_KEY = 'config'
export const LAST_SYNCED_CONFIG_STORAGE_KEY = 'lastSyncedConfig'
export const GOOGLE_DRIVE_TOKEN_STORAGE_KEY = '__googleDriveToken'

// Legacy storage keys for migration only
// TODO: Remove these after all users have migrated to v38+
export const LEGACY_CONFIG_SCHEMA_VERSION_STORAGE_KEY = '__configSchemaVersion'

export const DETECTED_CODE_STORAGE_KEY = 'detectedCode'
export const DEFAULT_DETECTED_CODE = 'eng' as const
export const CONFIG_SCHEMA_VERSION = 40

export const DEFAULT_FLOATING_BUTTON_POSITION = 0.66

export const DEFAULT_CONFIG: Config = {
  language: {
    sourceCode: 'auto',
    targetCode: 'cmn',
    level: 'intermediate',
  },
  providersConfig: DEFAULT_PROVIDER_CONFIG_LIST,
  read: {
    providerId: 'openai-default',
  },
  translate: {
    providerId: 'microsoft-translate-default',
    mode: 'bilingual',
    node: {
      enabled: true,
      hotkey: 'Control',
    },
    page: {
      // TODO: change this to "all" for users once our translation algorithm can handle most cases elegantly
      range: import.meta.env.DEV ? 'all' : 'main',
      autoTranslatePatterns: ['news.ycombinator.com'],
      autoTranslateLanguages: [],
      shortcut: DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY,
      enableLLMDetection: false,
      preload: {
        margin: DEFAULT_PRELOAD_MARGIN,
        threshold: DEFAULT_PRELOAD_THRESHOLD,
      },
    },
    enableAIContentAware: false,
    customPromptsConfig: DEFAULT_TRANSLATE_PROMPTS_CONFIG,
    requestQueueConfig: {
      capacity: DEFAULT_REQUEST_CAPACITY,
      rate: DEFAULT_REQUEST_RATE,
    },
    batchQueueConfig: {
      maxCharactersPerBatch: DEFAULT_BATCH_CONFIG.maxCharactersPerBatch,
      maxItemsPerBatch: DEFAULT_BATCH_CONFIG.maxItemsPerBatch,
    },
    translationNodeStyle: {
      preset: TRANSLATION_NODE_STYLE_ON_INSTALLED,
      isCustom: false,
      customCSS: null,
    },
  },
  tts: DEFAULT_TTS_CONFIG,
  floatingButton: {
    enabled: true,
    position: DEFAULT_FLOATING_BUTTON_POSITION,
    disabledFloatingButtonPatterns: [],
    clickAction: 'panel',
  },
  selectionToolbar: {
    enabled: true,
    disabledSelectionToolbarPatterns: [],
  },
  sideContent: {
    width: DEFAULT_SIDE_CONTENT_WIDTH,
  },
  betaExperience: {
    enabled: false,
  },
  contextMenu: {
    enabled: true,
  },
  inputTranslation: {
    enabled: true,
    direction: 'normal',
    useCustomTarget: true,
    targetCode: 'eng',
    timeThreshold: 300,
  },
  videoSubtitles: {
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
