import type { Config } from '@/types/config/config'

export const description = 'Add DeeplX provider'

export const configExample: Config = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'jpn',
    level: 'intermediate',
  },
  providersConfig: {
    openai: {
      apiKey: 'sk-1234567890',
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
      baseURL: 'https://api.deeplx.org/abcdefghijklmnopqrst',
    },
  },
  read: {
    provider: 'openai',
    models: {
      openai: {
        model: 'gpt-4o-mini',
        isCustomModel: true,
        customModel: 'gpt-4.1-nano',
      },
      deepseek: {
        model: 'deepseek-chat',
        isCustomModel: false,
        customModel: '',
      },
    },
  },
  translate: {
    provider: 'microsoft',
    models: {
      microsoft: null,
      google: null,
      deeplx: null,
      openai: {
        model: 'gpt-4o-mini',
        isCustomModel: true,
        customModel: 'gpt-4.1-nano',
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
    },
    node: {
      enabled: true,
      hotkey: 'Control',
    },
    page: {
      range: 'main',
      autoTranslatePatterns: ['news.ycombinator.com'],
    },
    promptsConfig: {
      prompt: 'Read Frog: TRANSLATE_DEFAULT_PROMPT',
      patterns: [
        {
          id: 'Read Frog: TRANSLATE_DEFAULT_PROMPT',
          name: 'Read Frog: TRANSLATE_DEFAULT_PROMPT',
          prompt: `Treat input as plain text input and translate it into {{targetLang}}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes.
Input:
{{input}}
`,
        },
      ],
    },
    requestQueueConfig: {
      capacity: 300,
      rate: 5,
    },
    translationNodeStyle: 'default',
  },
  floatingButton: {
    enabled: true,
    position: 0.66,
  },
  sideContent: {
    width: 400,
  },
}
