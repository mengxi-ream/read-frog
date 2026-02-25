const NAME_MAPPING = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  gemini: "Gemini",
  deeplx: "DeepLX",
  microsoft: "Microsoft Translator",
  google: "Google Translate",
}

export function migrate(oldConfig: any): any {
  const newProvidersConfig = [
    {
      name: "Google Translate",
      provider: "google",
    },
    {
      name: "Microsoft Translator",
      provider: "microsoft",
    },
    {
      name: NAME_MAPPING.openai,
      provider: "openai",
      apiKey: oldConfig.providersConfig.openai.apiKey,
      baseURL: oldConfig.providersConfig.openai.baseURL === "" ? undefined : oldConfig.providersConfig.openai.baseURL,
      models: {
        read: oldConfig.read.models.openai,
        translate: oldConfig.translate.models.openai,
      },
    },
    {
      name: NAME_MAPPING.deepseek,
      provider: "deepseek",
      apiKey: oldConfig.providersConfig.deepseek.apiKey,
      baseURL: oldConfig.providersConfig.deepseek.baseURL === "" ? undefined : oldConfig.providersConfig.deepseek.baseURL,
      models: {
        read: oldConfig.read.models.deepseek,
        translate: oldConfig.translate.models.deepseek,
      },
    },
    {
      name: NAME_MAPPING.gemini,
      provider: "gemini",
      apiKey: oldConfig.providersConfig.gemini.apiKey,
      baseURL: oldConfig.providersConfig.gemini.baseURL === "" ? undefined : oldConfig.providersConfig.gemini.baseURL,
      models: {
        read: oldConfig.read.models.gemini,
        translate: oldConfig.translate.models.gemini,
      },
    },
    {
      name: NAME_MAPPING.deeplx,
      provider: "deeplx",
      apiKey: oldConfig.providersConfig.deeplx.apiKey,
      baseURL: oldConfig.providersConfig.deeplx.baseURL === "" ? undefined : oldConfig.providersConfig.deeplx.baseURL,
    },
  ]

  const newReadConfig = {
    providerName: NAME_MAPPING[oldConfig.read.provider as keyof typeof NAME_MAPPING],
  }

  const newTranslateProviderName = NAME_MAPPING[oldConfig.translate.provider as keyof typeof NAME_MAPPING]

  const { models, provider, ...restTranslateConfig } = oldConfig.translate
  const newTranslateConfig = {
    providerName: newTranslateProviderName,
    ...restTranslateConfig,
  }

  return {
    ...oldConfig,
    providersConfig: newProvidersConfig,
    read: newReadConfig,
    translate: newTranslateConfig,
  }
}
