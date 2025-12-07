import type { TestSeriesObject } from './types'

export const testSeries: TestSeriesObject = {
  'complex-config-from-v020': {
    description: 'Remove detectedCode from language config',
    config: {
      language: {
        sourceCode: 'spa',
        targetCode: 'eng',
        level: 'advanced',
      },
      providersConfig: [
        {
          id: 'google-default',
          enabled: true,
          name: 'Google Translate',
          provider: 'google',
        },
        {
          id: 'microsoft-default',
          enabled: true,
          name: 'Microsoft Translator',
          provider: 'microsoft',
        },
        {
          id: 'openai-default',
          enabled: true,
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'sk-custom-prompt-key',
          baseURL: 'https://api.openai.com/v1',
          models: {
            read: {
              model: 'gpt-4o-mini',
              isCustomModel: true,
              customModel: 'gpt-5-custom',
            },
            translate: {
              model: 'gpt-4o-mini',
              isCustomModel: true,
              customModel: 'translate-gpt-custom',
            },
          },
        },
        {
          id: 'deepseek-default',
          enabled: true,
          name: 'DeepSeek',
          provider: 'deepseek',
          apiKey: 'ds-custom',
          baseURL: 'https://api.custom.com/v1',
          models: {
            read: {
              model: 'deepseek-chat',
              isCustomModel: true,
              customModel: 'deepseek-v4-pro',
            },
            translate: {
              model: 'deepseek-chat',
              isCustomModel: false,
              customModel: '',
            },
          },
        },
        {
          id: 'gemini-default',
          enabled: true,
          name: 'Gemini',
          provider: 'gemini',
          apiKey: undefined,
          baseURL: undefined,
          models: {
            read: {
              model: 'gemini-2.5-pro',
              isCustomModel: false,
              customModel: '',
            },
            translate: {
              model: 'gemini-2.5-pro',
              isCustomModel: false,
              customModel: '',
            },
          },
        },
        {
          id: 'deeplx-default',
          enabled: true,
          name: 'DeepLX',
          provider: 'deeplx',
          apiKey: undefined,
          baseURL: 'https://deeplx.vercel.app',
        },
      ],
      read: {
        providerId: 'deepseek-default',
      },
      translate: {
        providerId: 'openai-default',
        mode: 'translationOnly',
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: 'Alt',
        },
        page: {
          range: 'all',
          autoTranslatePatterns: ['spanish-news.com', 'elmundo.es'],
          autoTranslateLanguages: [],
          shortcut: ['alt', 'b'],
          enableLLMDetection: false,
          preload: {
            margin: 1000,
            threshold: 0,
          },
        },
        customPromptsConfig: {
          promptId: '123e4567-e89b-12d3-a456-426614174000',
          patterns: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Technical Translation',
              systemPrompt: '',
              prompt: 'Technical translation from Spanish to {{targetLang}}. Preserve technical terms and accuracy:\n{{input}}',
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
          preset: 'blur',
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        providerId: null,
        model: 'tts-1',
        voice: 'alloy',
        speed: 1,
      },
      floatingButton: {
        enabled: true,
        position: 0.75,
        disabledFloatingButtonPatterns: ['github.com'],
      },
      sideContent: {
        width: 700,
      },
      selectionToolbar: {
        enabled: false,
        disabledSelectionToolbarPatterns: [],
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
    },
  },
  'config-with-no-default-openai-model': {
    description: 'Remove detectedCode from language config',
    config: {
      floatingButton: {
        disabledFloatingButtonPatterns: [],
        enabled: true,
        position: 0.66,
      },
      language: {
        level: 'intermediate',
        sourceCode: 'auto',
        targetCode: 'cmn',
      },
      providersConfig: [
        {
          id: 'google-default',
          enabled: true,
          name: 'Google Translate',
          provider: 'google',
        },
        {
          id: 'microsoft-default',
          enabled: true,
          name: 'Microsoft Translator',
          provider: 'microsoft',
        },
        {
          id: 'gemini-default',
          enabled: true,
          apiKey: '1',
          models: {
            read: {
              customModel: null,
              isCustomModel: false,
              model: 'gemini-2.5-pro',
            },
            translate: {
              customModel: 'gemini-1.5-pro',
              isCustomModel: true,
              model: 'gemini-2.5-pro',
            },
          },
          name: 'Gemini',
          provider: 'gemini',
        },
        {
          id: 'deeplx-default',
          enabled: true,
          apiKey: '11113',
          name: 'DeepLX',
          provider: 'deeplx',
        },
      ],
      read: {
        providerId: 'gemini-default',
      },
      selectionToolbar: {
        enabled: true,
        disabledSelectionToolbarPatterns: [],
      },
      sideContent: {
        width: 420,
      },
      translate: {
        mode: 'translationOnly',
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: 'Control',
        },
        page: {
          autoTranslateLanguages: [],
          autoTranslatePatterns: [
            'news.ycombinator.com',
          ],
          range: 'all',
          shortcut: [
            'alt',
            'q',
          ],
          enableLLMDetection: false,
          preload: {
            margin: 1000,
            threshold: 0,
          },
        },
        customPromptsConfig: {
          patterns: [],
          promptId: null,
        },
        providerId: 'gemini-default',
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: 'default',
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        providerId: null,
        model: 'tts-1',
        voice: 'alloy',
        speed: 1,
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
    },
  },
}
