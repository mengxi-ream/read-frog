import type { TestSeriesObject } from "./types"

export const testSeries: TestSeriesObject = {
  "complex-config-from-v020": {
    description: "Adds customPromptsConfig to videoSubtitles",
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
          enableLLMDetection: false,
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
          enableSkipLanguagesLLMDetection: false,
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
        providerId: null,
        model: "tts-1",
        voice: "alloy",
        speed: 1,
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
        features: {
          translate: {
            providerId: "openai-default",
          },
          vocabularyInsight: {
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
        mode: "all",
        patterns: [],
      },
    },
  },
  "config-with-no-default-openai-model": {
    description: "Adds customPromptsConfig to videoSubtitles",
    config: {
      floatingButton: {
        disabledFloatingButtonPatterns: [],
        enabled: true,
        position: 0.66,
        clickAction: "panel",
      },
      language: {
        level: "intermediate",
        sourceCode: "auto",
        targetCode: "cmn",
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
          id: "google-default",
          enabled: true,
          apiKey: "1",
          model: {
            customModel: "gemini-1.5-pro",
            isCustomModel: true,
            model: "gemini-2.5-pro",
          },
          name: "Gemini",
          provider: "google",
        },
        {
          id: "deeplx-default",
          enabled: true,
          apiKey: "11113",
          name: "DeepLX",
          provider: "deeplx",
        },
      ],
      selectionToolbar: {
        enabled: true,
        disabledSelectionToolbarPatterns: [],
        features: {
          translate: {
            providerId: "google-default",
          },
          vocabularyInsight: {
            providerId: "google-default",
          },
        },
      },
      sideContent: {
        width: 420,
      },
      translate: {
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "control",
        },
        page: {
          autoTranslateLanguages: [],
          autoTranslatePatterns: [
            "news.ycombinator.com",
          ],
          range: "all",
          shortcut: [
            "alt",
            "q",
          ],
          enableLLMDetection: false,
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
          enableSkipLanguagesLLMDetection: false,
        },
        customPromptsConfig: {
          patterns: [],
          promptId: null,
        },
        providerId: "google-default",
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
        providerId: null,
        model: "tts-1",
        voice: "alloy",
        speed: 1,
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
        mode: "all",
        patterns: [],
      },
    },
  },
}
