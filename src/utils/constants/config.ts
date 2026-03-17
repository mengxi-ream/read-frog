import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { PageTranslateRange } from "@/types/config/translate"
import { CUSTOM_ACTION_TEMPLATES } from "./custom-action-templates"
import { DEFAULT_TRANSLATE_PROMPTS_CONFIG } from "./prompt"
import { DEFAULT_PROVIDER_CONFIG_LIST } from "./providers"
import { DEFAULT_SELECTION_OVERLAY_OPACITY } from "./selection"
import { DEFAULT_SIDE_CONTENT_WIDTH } from "./side"
import { DEFAULT_BACKGROUND_OPACITY, DEFAULT_DISPLAY_MODE, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SCALE, DEFAULT_FONT_WEIGHT, DEFAULT_SUBTITLE_COLOR, DEFAULT_SUBTITLE_POSITION, DEFAULT_TRANSLATION_POSITION } from "./subtitles"
import { DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY, DEFAULT_BATCH_CONFIG, DEFAULT_MIN_CHARACTERS_PER_NODE, DEFAULT_MIN_WORDS_PER_NODE, DEFAULT_PRELOAD_MARGIN, DEFAULT_PRELOAD_THRESHOLD, DEFAULT_REQUEST_CAPACITY, DEFAULT_REQUEST_RATE } from "./translate"
import { TRANSLATION_NODE_STYLE_ON_INSTALLED } from "./translation-node-style"
import { DEFAULT_TTS_CONFIG } from "./tts"

export const CONFIG_STORAGE_KEY = "config"
export const LAST_SYNCED_CONFIG_STORAGE_KEY = "lastSyncedConfig"
export const GOOGLE_DRIVE_TOKEN_STORAGE_KEY = "__googleDriveToken"

export const THEME_STORAGE_KEY = "theme"
export const DETECTED_CODE_STORAGE_KEY = "detectedCode"
export const DEFAULT_DETECTED_CODE = "eng" as const
export const CONFIG_SCHEMA_VERSION = 65

export const DEFAULT_FLOATING_BUTTON_POSITION = 0.66

function createDefaultDictionaryAction(): SelectionToolbarCustomAction | null {
  const template = CUSTOM_ACTION_TEMPLATES.find(t => t.id === "dictionary")
  if (!template)
    return null

  const action = template.createAction("openai-default")
  return {
    ...action,
    id: "default-dictionary",
    outputSchema: action.outputSchema.map(field => ({
      ...field,
      id: field.id.startsWith("dictionary-")
        ? `default-${field.id}`
        : `default-dictionary-${field.id}`,
    })),
  }
}

const defaultDictionaryAction = createDefaultDictionaryAction()

export const DEFAULT_CONFIG: Config = {
  language: {
    sourceCode: "auto",
    targetCode: "cmn",
    level: "intermediate",
  },
  providersConfig: DEFAULT_PROVIDER_CONFIG_LIST,
  translate: {
    providerId: "microsoft-translate-default",
    mode: "bilingual",
    node: {
      enabled: false,
      hotkey: "control",
    },
    page: {
      // TODO: change this to "all" for users once our translation algorithm can handle most cases elegantly
      range: import.meta.env.DEV ? "all" : "main",
      autoTranslatePatterns: ["news.ycombinator.com"],
      autoTranslateLanguages: [],
      shortcut: DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY,
      preload: {
        margin: DEFAULT_PRELOAD_MARGIN,
        threshold: DEFAULT_PRELOAD_THRESHOLD,
      },
      minCharactersPerNode: DEFAULT_MIN_CHARACTERS_PER_NODE,
      minWordsPerNode: DEFAULT_MIN_WORDS_PER_NODE,
      skipLanguages: [],
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
  languageDetection: {
    mode: "basic",
  },
  tts: DEFAULT_TTS_CONFIG,
  floatingButton: {
    enabled: true,
    position: DEFAULT_FLOATING_BUTTON_POSITION,
    disabledFloatingButtonPatterns: [],
    clickAction: "translate",
  },
  selectionToolbar: {
    enabled: true,
    disabledSelectionToolbarPatterns: [],
    opacity: DEFAULT_SELECTION_OVERLAY_OPACITY,
    features: {
      translate: {
        enabled: true,
        providerId: "microsoft-translate-default",
      },
      speak: {
        enabled: true,
      },
      vocabularyInsight: {
        enabled: true,
        providerId: "openai-default",
      },
    },
    customActions: defaultDictionaryAction ? [defaultDictionaryAction] : [],
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
    providerId: "microsoft-translate-default",
    fromLang: "targetCode",
    toLang: "sourceCode",
    enableCycle: false,
    timeThreshold: 300,
  },
  videoSubtitles: {
    enabled: true,
    autoStart: false,
    providerId: "microsoft-translate-default",
    style: {
      displayMode: DEFAULT_DISPLAY_MODE,
      translationPosition: DEFAULT_TRANSLATION_POSITION,
      main: {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontScale: DEFAULT_FONT_SCALE,
        color: DEFAULT_SUBTITLE_COLOR,
        fontWeight: DEFAULT_FONT_WEIGHT,
      },
      translation: {
        fontFamily: DEFAULT_FONT_FAMILY,
        fontScale: DEFAULT_FONT_SCALE,
        color: DEFAULT_SUBTITLE_COLOR,
        fontWeight: DEFAULT_FONT_WEIGHT,
      },
      container: {
        backgroundOpacity: DEFAULT_BACKGROUND_OPACITY,
      },
    },
    aiSegmentation: false,
    requestQueueConfig: {
      capacity: DEFAULT_REQUEST_CAPACITY,
      rate: DEFAULT_REQUEST_RATE,
    },
    batchQueueConfig: {
      maxCharactersPerBatch: DEFAULT_BATCH_CONFIG.maxCharactersPerBatch,
      maxItemsPerBatch: DEFAULT_BATCH_CONFIG.maxItemsPerBatch,
    },
    customPromptsConfig: DEFAULT_TRANSLATE_PROMPTS_CONFIG,
    position: DEFAULT_SUBTITLE_POSITION,
  },
  siteControl: {
    mode: "blacklist",
    blacklistPatterns: [],
    whitelistPatterns: [],
  },
}

export const PAGE_TRANSLATE_RANGE_ITEMS: Record<
  PageTranslateRange,
  { label: string }
> = {
  main: { label: "Main" },
  all: { label: "All" },
}
