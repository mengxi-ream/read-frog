export const ConfigV1Example = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'jpn',
    level: 'intermediate',
  },
  provider: 'openai',
  providersConfig: {
    openai: {
      apiKey: 'sk-1234567890',
      model: 'gpt-4.1-mini',
      isCustomModel: false,
      customModel: '',
    },
    deepseek: {
      apiKey: undefined,
      model: 'deepseek-chat',
      isCustomModel: false,
      customModel: '',
    },
  },
  manualTranslate: {
    enabled: true,
    hotkey: 'Control',
  },
  floatingButton: {
    enabled: true,
    position: 0.66,
  },
  sideContent: {
    width: 400,
  },
}

export const ConfigV2Example = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'jpn',
    level: 'intermediate',
  },
  provider: 'openai',
  providersConfig: {
    openai: {
      apiKey: 'sk-1234567890',
      model: 'gpt-4.1-mini',
      isCustomModel: false,
      customModel: '',
    },
    deepseek: {
      apiKey: undefined,
      model: 'deepseek-chat',
      isCustomModel: false,
      customModel: '',
    },
  },
  manualTranslate: {
    enabled: true,
    hotkey: 'Control',
  },
  pageTranslate: {
    range: 'mainContent',
  },
  floatingButton: {
    enabled: true,
    position: 0.66,
  },
  sideContent: {
    width: 400,
  },
}

export const ConfigV3Example = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'jpn',
    level: 'intermediate',
  },
  provider: 'openai',
  providersConfig: {
    openai: {
      apiKey: 'sk-1234567890',
      model: 'gpt-4.1-mini',
      isCustomModel: false,
      customModel: '',
    },
    deepseek: {
      apiKey: undefined,
      model: 'deepseek-chat',
      isCustomModel: false,
      customModel: '',
    },
  },
  translate: {
    provider: 'microsoft',
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

export const ConfigV4Example = {
  language: {
    detectedCode: 'eng',
    sourceCode: 'auto',
    targetCode: 'jpn',
    level: 'intermediate',
  },
  providersConfig: {
    openai: {
      apiKey: 'sk-1234567890',
    },
    deepseek: {
      apiKey: undefined,
    },
    openrouter: {
      apiKey: undefined,
    },
  },
  read: {
    provider: 'openai',
    models: {
      openai: {
        name: 'gpt-4.1-mini',
        isCustomModel: false,
        customModel: '',
      },
      deepseek: {
        name: 'deepseek-chat',
        isCustomModel: false,
        customModel: '',
      },
      openrouter: {
        name: 'deepseek/deepseek-chat-v3-0324:free',
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
        name: 'gpt-4.1-mini',
        isCustomModel: false,
        customModel: '',
      },
      deepseek: {
        name: 'deepseek-chat',
        isCustomModel: false,
        customModel: '',
      },
      openrouter: {
        name: 'meta-llama/llama-4-maverick:free',
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
