import type { Config } from '@/types/config/config'

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

export const ConfigV3Example: Config = {
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
