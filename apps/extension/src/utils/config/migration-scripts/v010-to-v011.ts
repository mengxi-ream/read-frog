export function migrate(oldConfig: any): any {
  // Integrate Gemini Api
  const newConfig = {
    ...oldConfig,
    providersConfig: {
      ...oldConfig.providersConfig,
      gemini: {
        apiKey: undefined,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      },
    },
    translate: {
      ...oldConfig.translate,
      models: {
        ...oldConfig.translate?.models,
        gemini: {
          model: 'gemini-2.5-pro',
          isCustomModel: false,
          customModel: '',
        },
      },
    },
  }

  return newConfig
}
