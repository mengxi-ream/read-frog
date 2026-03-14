import type { TestSeriesObject } from "./types"
import { createDefaultTTSLanguageVoices, EDGE_TTS_FALLBACK_VOICE } from "@/types/config/tts"

export const testSeries: TestSeriesObject = {
  "complex-config-from-v020": {
    description: "Adds enabled toggle to selection toolbar built-in features and adds speak feature",
    config: {
      language: {
        sourceCode: "spa",
        targetCode: "eng",
        level: "advanced",
      },
      providersConfig: [
        {
          id: "microsoft-translate-default",
          enabled: true,
          name: "Microsoft Translator",
          provider: "microsoft-translate",
        },
        {
          id: "google-translate-default",
          enabled: true,
          name: "Google Translate",
          provider: "google-translate",
        },
        {
          id: "openai-default",
          enabled: true,
          name: "OpenAI",
          provider: "openai",
          apiKey: "sk-custom-prompt-key",
          baseURL: "https://api.openai.com/v1",
          model: {
            model: "gpt-4o-mini",
            isCustomModel: true,
            customModel: "translate-gpt-custom",
          },
        },
        {
          id: "deepseek-default",
          enabled: true,
          name: "DeepSeek",
          provider: "deepseek",
          apiKey: "ds-custom",
          baseURL: "https://api.custom.com/v1",
          model: {
            model: "deepseek-chat",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: undefined,
          baseURL: undefined,
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "deeplx-default",
          enabled: true,
          name: "DeepLX",
          provider: "deeplx",
          apiKey: undefined,
          baseURL: "https://deeplx.vercel.app",
        },
      ],
      translate: {
        providerId: "openai-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: ["spanish-news.com", "elmundo.es"],
          autoTranslateLanguages: [],
          shortcut: ["alt", "b"],
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: "123e4567-e89b-12d3-a456-426614174000",
          patterns: [
            {
              id: "123e4567-e89b-12d3-a456-426614174000",
              name: "Technical Translation",
              systemPrompt: "",
              prompt: "Technical translation from Spanish to {{targetLang}}. Preserve technical terms and accuracy:\n{{input}}",
            },
          ],
        },
        requestQueueConfig: {
          capacity: 400,
          rate: 8,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "blur",
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        defaultVoice: EDGE_TTS_FALLBACK_VOICE,
        languageVoices: createDefaultTTSLanguageVoices(),
        rate: 0,
        pitch: 0,
        volume: 0,
      },
      floatingButton: {
        enabled: true,
        position: 0.75,
        disabledFloatingButtonPatterns: ["github.com"],
        clickAction: "panel",
      },
      sideContent: {
        width: 700,
      },
      selectionToolbar: {
        enabled: false,
        disabledSelectionToolbarPatterns: [],
        customActions: [
          {
            id: "default-dictionary",
            name: "Dictionary",
            enabled: true,
            icon: "tabler:book-2",
            providerId: "deepseek-default",
            systemPrompt:
          "You are a dictionary assistant for language learners. Given a term and its surrounding context, provide a comprehensive and concise dictionary entry. When a term has multiple meanings, focus on the contextual meaning. Return the term in its base/canonical form. Respond in {{targetLang}}.",
            prompt: "Term: {{selection}}\nContext: {{context}}\nTarget language: {{targetLang}}",
            outputSchema: [
              { id: "default-dictionary-term", name: "Term", type: "string", description: "", speaking: true },
              { id: "default-dictionary-definition", name: "Definition", type: "string", description: "", speaking: false },
              { id: "default-dictionary-context", name: "Context", type: "string", description: "", speaking: true },
              { id: "default-dictionary-examples", name: "Examples", type: "string", description: "", speaking: false },
              { id: "default-dictionary-synonyms", name: "Synonyms", type: "string", description: "", speaking: false },
              { id: "default-dictionary-antonyms", name: "Antonyms", type: "string", description: "", speaking: false },
            ],
          },
        ],
        features: {
          translate: {
            enabled: true,
            providerId: "openai-default",
          },
          speak: {
            enabled: true,
          },
          vocabularyInsight: {
            enabled: true,
            providerId: "deepseek-default",
          },
        },
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "openai-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 400,
          rate: 8,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: { percent: 10, anchor: "bottom" },
      },
      inputTranslation: {
        enabled: true,
        providerId: "openai-default",
        fromLang: "targetCode",
        toLang: "sourceCode",
        enableCycle: false,
        timeThreshold: 300,
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
      languageDetection: {
        mode: "basic",
        providerId: "openai-default",
      },
    },
  },
  "config-with-llm-detection-enabled": {
    description: "Single provider, LLM detection mode; features get enabled toggles and speak added",
    config: {
      language: {
        sourceCode: "jpn",
        targetCode: "eng",
        level: "beginner",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: "goog-key",
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
      translate: {
        providerId: "google-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: ["alt", "b"],
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "default",
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        defaultVoice: EDGE_TTS_FALLBACK_VOICE,
        languageVoices: createDefaultTTSLanguageVoices(),
        rate: 0,
        pitch: 0,
        volume: 0,
      },
      floatingButton: {
        enabled: true,
        position: 0.5,
        disabledFloatingButtonPatterns: [],
        clickAction: "panel",
      },
      sideContent: {
        width: 420,
      },
      selectionToolbar: {
        enabled: true,
        disabledSelectionToolbarPatterns: [],
        customActions: [
          {
            id: "default-dictionary",
            name: "Dictionary",
            enabled: true,
            icon: "tabler:book-2",
            providerId: "google-default",
            systemPrompt:
          "You are a dictionary assistant for language learners. Given a term and its surrounding context, provide a comprehensive and concise dictionary entry. When a term has multiple meanings, focus on the contextual meaning. Return the term in its base/canonical form. Respond in {{targetLang}}.",
            prompt: "Term: {{selection}}\nContext: {{context}}\nTarget language: {{targetLang}}",
            outputSchema: [
              { id: "default-dictionary-term", name: "Term", type: "string", description: "", speaking: true },
              { id: "default-dictionary-definition", name: "Definition", type: "string", description: "", speaking: false },
              { id: "default-dictionary-context", name: "Context", type: "string", description: "", speaking: true },
              { id: "default-dictionary-examples", name: "Examples", type: "string", description: "", speaking: false },
              { id: "default-dictionary-synonyms", name: "Synonyms", type: "string", description: "", speaking: false },
              { id: "default-dictionary-antonyms", name: "Antonyms", type: "string", description: "", speaking: false },
            ],
          },
        ],
        features: {
          translate: {
            enabled: true,
            providerId: "google-default",
          },
          speak: {
            enabled: true,
          },
          vocabularyInsight: {
            enabled: true,
            providerId: "google-default",
          },
        },
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "google-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: { percent: 10, anchor: "bottom" },
      },
      inputTranslation: {
        enabled: true,
        providerId: "google-default",
        fromLang: "targetCode",
        toLang: "sourceCode",
        enableCycle: false,
        timeThreshold: 300,
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
      languageDetection: {
        mode: "llm",
        providerId: "google-default",
      },
    },
  },
}
