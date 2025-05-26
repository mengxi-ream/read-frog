export const configExample = {
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
      model: 'gpt-4o-mini',
      isCustomModel: true,
      customModel: 'gpt-4.1-nano',
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
