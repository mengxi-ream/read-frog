export const description = 'Add base URL configuration'

export const configExample = {
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
    openrouter: {
      apiKey: undefined,
      baseURL: 'https://openrouter.ai/api/v1',
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
      openrouter: {
        model: 'meta-llama/llama-4-maverick:free',
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
    },
  },
  floatingButton: {
    enabled: true,
    position: 0.66,
  },
  sideContent: {
    width: 400,
  },
}
