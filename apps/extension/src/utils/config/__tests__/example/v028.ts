import type { TestSeriesObject } from './types'
import type { Config } from '@/types/config/config'

export const testSeries: TestSeriesObject = {
  'complex-config-from-v020': {
    description: 'Add selection toolbar enabled config',
    config: {
      language: {
        detectedCode: 'spa',
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
        node: {
          enabled: true,
          hotkey: 'Alt',
        },
        page: {
          range: 'all',
          autoTranslatePatterns: ['spanish-news.com', 'elmundo.es'],
          autoTranslateLanguages: [],
        },
        promptsConfig: {
          prompt: '123e4567-e89b-12d3-a456-426614174000',
          patterns: [
            {
              id: 'default',
              name: 'default',
              prompt: `You are a professional {{targetLang}} native translator who needs to fluently translate text into {{targetLang}}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.

Translate to {{targetLang}}:
{{input}}
`,
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Technical Translation',
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
        translationNodeStyle: 'blur',
        customAutoTranslateShortcutKey: ['alt', 'b'],
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
    } satisfies Config,
  },
  'config-with-no-default-openai-model': {
    description: 'Add selection toolbar disabled patterns config',
    config: {
      floatingButton: {
        disabledFloatingButtonPatterns: [],
        enabled: true,
        position: 0.66,
      },
      language: {
        detectedCode: 'eng',
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
        customAutoTranslateShortcutKey: [
          'alt',
          'q',
        ],
        mode: 'translationOnly',
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
        },
        promptsConfig: {
          patterns: [
            {
              id: 'default',
              name: 'default',
              prompt: 'You are a professional {{targetLang}} native translator who needs to fluently translate text into {{targetLang}}.\n\n## Translation Rules\n1. Output only the translated content, without explanations or additional content (such as "Here\'s the translation:" or "Translation as follows:")\n2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.\n3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.\n4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.\n\nTranslate to {{targetLang}}:\n{{input}}\n',
            },
          ],
          prompt: 'default',
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
        translationNodeStyle: 'default',
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
    } satisfies Config,
  },
}
