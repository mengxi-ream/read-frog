const ID_MAPPING = {
  "OpenAI": "openai-default",
  "DeepSeek": "deepseek-default",
  "Gemini": "gemini-default",
  "DeepLX": "deeplx-default",
  "Microsoft Translator": "microsoft-default",
  "Google Translate": "google-default",
}

export function migrate(oldConfig: any): any {
  const newProvidersConfig = oldConfig.providersConfig.map((provider: any) => {
    return {
      id: ID_MAPPING[provider.name as keyof typeof ID_MAPPING],
      enabled: true,
      ...provider,
    }
  })

  const newReadConfig = {
    providerId: ID_MAPPING[oldConfig.read.providerName as keyof typeof ID_MAPPING],
  }

  const newTranslateProviderId = ID_MAPPING[oldConfig.translate.providerName as keyof typeof ID_MAPPING]

  const { providerName, ...restTranslateConfig } = oldConfig.translate
  const newTranslateConfig = {
    providerId: newTranslateProviderId,
    ...restTranslateConfig,
  }

  return {
    ...oldConfig,
    providersConfig: newProvidersConfig,
    read: newReadConfig,
    translate: newTranslateConfig,
  }
}
