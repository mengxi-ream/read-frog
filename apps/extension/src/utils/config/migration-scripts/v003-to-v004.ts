export function migrate(oldConfig: any): any {
  const oldProvidersConfig = oldConfig.providersConfig
  const transferredProvidersConfig = Object.fromEntries(
    Object.entries(oldProvidersConfig).map(([key, value]) => {
      return [key, {
        apiKey: (value as any).apiKey,
      }]
    }),
  )

  const newProvidersConfig = {
    ...transferredProvidersConfig,
    openrouter: {
      apiKey: undefined,
    },
  }

  const transferredModelsConfig = Object.fromEntries(
    Object.entries(oldProvidersConfig).map(([key, value]) => {
      return [key, {
        model: (value as any).model,
        isCustomModel: (value as any).isCustomModel,
        customModel: (value as any).customModel,
      }]
    }),
  )
  const newReadConfig = {
    provider: oldConfig.provider,
    models: transferredModelsConfig,
  }
  const newTranslateModelsConfig = {
    ...transferredModelsConfig,
    openrouter: {
      model: 'meta-llama/llama-4-maverick:free',
      isCustomModel: false,
      customModel: '',
    },
  }

  const newTranslateConfig = {
    provider: oldConfig.translate.provider,
    models: {
      google: null,
      microsoft: null,
      ...newTranslateModelsConfig,
    },
    node: oldConfig.translate.node,
    page: oldConfig.translate.page,
  }
  const { language, floatingButton, sideContent, ..._restConfig } = oldConfig
  return {
    language,
    floatingButton,
    sideContent,
    providersConfig: newProvidersConfig,
    read: newReadConfig,
    translate: newTranslateConfig,
  }
}
