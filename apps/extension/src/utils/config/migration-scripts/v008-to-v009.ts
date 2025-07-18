export function migrate(oldConfig: any): any {
  // 添加 Gemini 提供商配置
  const oldProvidersConfig = oldConfig.providersConfig
  const newProvidersConfig = {
    ...oldProvidersConfig,
    gemini: {
      apiKey: undefined,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/',
    },
  }

  // 添加 gemini 翻译模型配置
  const oldTranslateModels = oldConfig.translate.models
  const newTranslateModels = {
    ...oldTranslateModels,
    gemini: {
      model: 'gemini-2.5-pro',
      isCustomModel: false,
      customModel: '',
    },
  }

  return {
    ...oldConfig,
    providersConfig: newProvidersConfig,
    translate: {
      ...oldConfig.translate,
      models: newTranslateModels,
    },
  }
}
