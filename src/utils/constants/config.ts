import type { Config } from "@/types/config/config"
import type { FloatingButtonSide } from "@/types/config/floating-button"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import type { PageTranslateRange } from "@/types/config/translate"
import { DEFAULT_LAYOUT } from "@read-frog/layout-engine/presets"
import {
  buildDictionaryActionLayout,
  buildImproveWritingActionLayout,
  buildSentenceAnalysisActionLayout,
} from "@/utils/layout-host/slots"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"
import {
  BUILT_IN_ACTION_IDS,
  BUILT_IN_DICTIONARY_ACTION_ID,
  BUILT_IN_IMPROVE_WRITING_ACTION_ID,
  BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
} from "./custom-action"
import {
  createDictionaryDefinition,
  createImproveWritingDefinition,
  createSentenceAnalysisDefinition,
} from "./custom-action-templates"
import { DEFAULT_GLOSSARY_CONFIG } from "./glossary"
import {
  DEFAULT_SUBTITLE_TRANSLATE_PROMPTS_CONFIG,
  DEFAULT_TRANSLATE_PROMPTS_CONFIG,
} from "./prompt"
import {
  buildDefaultProviderConfigList,
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_PROVIDER_CONFIG_LIST,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "./providers"
import { DEFAULT_SELECTION_OVERLAY_OPACITY, SELECTION_TOOLBAR_FEATURE_IDS } from "./selection"
import { DEFAULT_SIDE_CONTENT_WIDTH } from "./side"
import {
  DEFAULT_BACKGROUND_OPACITY,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SCALE,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_SUBTITLE_COLOR,
  DEFAULT_SUBTITLE_POSITION,
  DEFAULT_SUBTITLES_TOGGLE_SHORTCUT_KEY,
  DEFAULT_TRANSLATION_POSITION,
} from "./subtitles"
import {
  DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_MIN_CHARACTERS_PER_NODE,
  DEFAULT_MIN_WORDS_PER_NODE,
  DEFAULT_PRELOAD_MARGIN,
  DEFAULT_PRELOAD_THRESHOLD,
  DEFAULT_REQUEST_CAPACITY,
  DEFAULT_REQUEST_RATE,
  DEFAULT_SELECTION_TRANSLATION_SHORTCUT_KEY,
  DEFAULT_TRANSLATION_MODE_SHORTCUT_KEY,
} from "./translate"
import { DEFAULT_TRANSLATION_HUB_SHORTCUT_KEY } from "./translation-hub"
import { TRANSLATION_NODE_STYLE_ON_INSTALLED } from "./translation-node-style"
import { DEFAULT_TTS_CONFIG } from "./tts"

export const CONFIG_STORAGE_KEY = "config"
export const LAST_SYNCED_CONFIG_STORAGE_KEY = "lastSyncedConfig"
export const GOOGLE_DRIVE_TOKEN_STORAGE_KEY = "__googleDriveToken"

export const THEME_STORAGE_KEY = "theme"
export const DEFAULT_DETECTED_CODE = "eng" as const
export const CONFIG_SCHEMA_VERSION = 109

export const DEFAULT_FLOATING_BUTTON_POSITION = 0.66
export const DEFAULT_FLOATING_BUTTON_SIDE: FloatingButtonSide = "right"

type OutputSchema = SelectionToolbarCustomActionOutputField[]

// A built-in action's card, rebuilt only when its fields' ids change: it is
// resolved on every read of the action. Cards place fields by id and hold no
// words of their own (the sentence analysis card's come from ctx), so nothing
// else about the language or the names goes into one.
function memoizeBuiltInLayout(build: (outputSchema: OutputSchema) => string | null) {
  let memo: { key: string; layout: string } | null = null
  return (outputSchema: OutputSchema): string => {
    const key = JSON.stringify(outputSchema.map((field) => field.id))
    if (memo?.key !== key) memo = { key, layout: build(outputSchema) ?? DEFAULT_LAYOUT }
    return memo.layout
  }
}

const getBuiltInDictionaryLayout = memoizeBuiltInLayout(buildDictionaryActionLayout)
const getBuiltInSentenceAnalysisLayout = memoizeBuiltInLayout(buildSentenceAnalysisActionLayout)
const getBuiltInImproveWritingLayout = memoizeBuiltInLayout(buildImproveWritingActionLayout)

/**
 * Build the code-owned Dictionary action definition in the current UI locale.
 * Only enabled/provider/Notebase state is persisted; callers merge those mutable
 * fields onto this definition at read time. The layout is generated here too
 * (never persisted), so it always follows the current locale's field names.
 */
export function createDefaultDictionaryAction(): SelectionToolbarCustomAction {
  const action = createDictionaryDefinition(BUILT_IN_AI_PROVIDER_ID)
  const outputSchema = action.outputSchema.map((field) => ({
    ...field,
    id: field.id.startsWith("dictionary-")
      ? `default-${field.id}`
      : `default-dictionary-${field.id}`,
  }))
  return {
    ...action,
    id: BUILT_IN_DICTIONARY_ACTION_ID,
    outputSchema,
    // Built for the renamed ids: the card's tail matches the fields it has
    // already placed by id, so the preset's card (keyed on `dictionary-*`)
    // would list every slot field a second time.
    layout: getBuiltInDictionaryLayout(outputSchema),
  }
}

/**
 * The code-owned Sentence Analysis action, built like the Dictionary: from its
 * preset, with `default-` field ids, in the current UI locale, and only its
 * enabled/provider/Notebase state persisted.
 */
export function createDefaultSentenceAnalysisAction(): SelectionToolbarCustomAction {
  const action = createSentenceAnalysisDefinition(BUILT_IN_AI_PROVIDER_ID)
  const outputSchema = action.outputSchema.map((field) => ({
    ...field,
    id: `default-${field.id}`,
  }))
  return {
    ...action,
    id: BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
    outputSchema,
    layout: getBuiltInSentenceAnalysisLayout(outputSchema),
  }
}

/**
 * The code-owned Improve Writing action, built like Sentence Analysis. Unlike
 * the other built-in actions it starts off the toolbar itself (see
 * `selectionToolbar.unpinned`): it waits in the toolbar's "more" menu. A
 * config without its state reads it as off, as the schema does.
 */
export function createDefaultImproveWritingAction(): SelectionToolbarCustomAction {
  const action = createImproveWritingDefinition(BUILT_IN_AI_PROVIDER_ID)
  const outputSchema = action.outputSchema.map((field) => ({
    ...field,
    id: `default-${field.id}`,
  }))
  return {
    ...action,
    id: BUILT_IN_IMPROVE_WRITING_ACTION_ID,
    enabled: false,
    outputSchema,
    layout: getBuiltInImproveWritingLayout(outputSchema),
  }
}

export const DEFAULT_CONFIG: Config = {
  language: {
    sourceCode: "auto",
    targetCode: "cmn",
    level: "intermediate",
  },
  providersConfig: DEFAULT_PROVIDER_CONFIG_LIST,
  pageTranslation: {
    providerId: MICROSOFT_TRANSLATE_PROVIDER_ID,
    mode: "bilingual",
    modeShortcut: DEFAULT_TRANSLATION_MODE_SHORTCUT_KEY,
    node: {
      enabled: false,
      hotkey: "control",
      forceRetranslation: false,
    },
    page: {
      range: "all",
      translateTitle: true,
      autoTranslatePatterns: ["*.news.ycombinator.com"],
      neverAutoTranslatePatterns: [],
      autoTranslateLanguages: [],
      shortcut: DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY,
      preload: {
        margin: DEFAULT_PRELOAD_MARGIN,
        threshold: DEFAULT_PRELOAD_THRESHOLD,
      },
      minCharactersPerNode: DEFAULT_MIN_CHARACTERS_PER_NODE,
      minWordsPerNode: DEFAULT_MIN_WORDS_PER_NODE,
      enableTargetLanguageSkip: true,
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
    side: DEFAULT_FLOATING_BUTTON_SIDE,
    disabledFloatingButtonPatterns: [],
    clickAction: "translate",
    locked: false,
  },
  selectionToolbar: {
    enabled: true,
    disabledSelectionToolbarPatterns: [],
    opacity: DEFAULT_SELECTION_OVERLAY_OPACITY,
    features: {
      translate: {
        enabled: true,
        providerId: MICROSOFT_TRANSLATE_PROVIDER_ID,
        shortcut: DEFAULT_SELECTION_TRANSLATION_SHORTCUT_KEY,
      },
      speak: {
        enabled: true,
      },
    },
    builtInActions: {
      dictionary: {
        enabled: true,
        providerId: BUILT_IN_AI_PROVIDER_ID,
      },
      sentenceAnalysis: {
        enabled: true,
        providerId: BUILT_IN_AI_PROVIDER_ID,
      },
      improveWriting: {
        enabled: true,
        providerId: BUILT_IN_AI_PROVIDER_ID,
      },
    },
    customActions: [],
    order: [...SELECTION_TOOLBAR_FEATURE_IDS, ...BUILT_IN_ACTION_IDS],
    unpinned: [BUILT_IN_IMPROVE_WRITING_ACTION_ID],
    noteSuggestion: {
      enabled: true,
      actionId: BUILT_IN_DICTIONARY_ACTION_ID,
      // Fresh installs always carry the OpenAI default provider; suggestions
      // start working the moment the user adds their key, with no hosted plan
      // requirement attached.
      providerId: DEFAULT_PROVIDER_CONFIG.openai.id,
    },
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
    providerId: MICROSOFT_TRANSLATE_PROVIDER_ID,
    fromLang: "targetCode",
    toLang: "sourceCode",
    enableCycle: false,
    timeThreshold: 300,
  },
  videoSubtitles: {
    enabled: true,
    autoStart: false,
    toggleShortcut: DEFAULT_SUBTITLES_TOGGLE_SHORTCUT_KEY,
    providerId: MICROSOFT_TRANSLATE_PROVIDER_ID,
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
      customCSS: null,
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
    customPromptsConfig: DEFAULT_SUBTITLE_TRANSLATE_PROMPTS_CONFIG,
    position: DEFAULT_SUBTITLE_POSITION,
  },
  siteControl: {
    mode: "blacklist",
    blacklistPatterns: [],
    whitelistPatterns: [],
  },
  siteRules: {
    userRules: [],
    disabledBuiltInRules: [],
  },
  uiLanguage: "auto",
  translationHub: {
    shortcut: DEFAULT_TRANSLATION_HUB_SHORTCUT_KEY,
    selectedProviderIds: null,
    sourceCode: null,
    targetCode: null,
    promptId: DEFAULT_TRANSLATE_PROMPTS_CONFIG.promptId,
  },
  glossary: { ...DEFAULT_GLOSSARY_CONFIG },
}

/**
 * Translate features start on Microsoft Translate, which is reachable everywhere; a fresh
 * install is moved onto Google Translate afterwards where that endpoint answers — see
 * `selectFreshTranslateProviders`.
 */
export function buildFreshDefaultConfig(): Config {
  return {
    ...DEFAULT_CONFIG,
    providersConfig: buildDefaultProviderConfigList(),
    selectionToolbar: {
      ...DEFAULT_CONFIG.selectionToolbar,
      builtInActions: {
        dictionary: {
          enabled: true,
          providerId: BUILT_IN_AI_PROVIDER_ID,
        },
        sentenceAnalysis: {
          enabled: true,
          providerId: BUILT_IN_AI_PROVIDER_ID,
        },
        improveWriting: {
          enabled: true,
          providerId: BUILT_IN_AI_PROVIDER_ID,
        },
      },
      customActions: [],
    },
  }
}

export const PAGE_TRANSLATE_RANGE_ITEMS: Record<PageTranslateRange, { label: string }> = {
  main: { label: "Main" },
  all: { label: "All" },
}
