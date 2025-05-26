export function migrate(oldConfig: any): any {
  // 添加 Ollama 提供商配置
  const oldProvidersConfig = oldConfig.providersConfig
  const newProvidersConfig = {
    ...oldProvidersConfig,
    ollama: {
      apiKey: undefined,
      baseURL: 'http://127.0.0.1:11434/v1',
    },
  }

  // 添加 Ollama 翻译模型配置
  const oldTranslateModels = oldConfig.translate.models
  const newTranslateModels = {
    ...oldTranslateModels,
    ollama: {
      model: 'gemma3:1b',
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
