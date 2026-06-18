const ID_MAPPING = {
    "OpenAI": "openai-default",
    "DeepSeek": "deepseek-default",
    "Gemini": "gemini-default",
    "DeepLX": "deeplx-default",
    "Microsoft Translator": "microsoft-default",
    "Google Translate": "google-default",
};
export function migrate(oldConfig) {
    const newProvidersConfig = oldConfig.providersConfig.map((provider) => {
        return {
            id: ID_MAPPING[provider.name],
            enabled: true,
            ...provider,
        };
    });
    const newReadConfig = {
        providerId: ID_MAPPING[oldConfig.read.providerName],
    };
    const newTranslateProviderId = ID_MAPPING[oldConfig.translate.providerName];
    const { providerName, ...restTranslateConfig } = oldConfig.translate;
    const newTranslateConfig = {
        providerId: newTranslateProviderId,
        ...restTranslateConfig,
    };
    return {
        ...oldConfig,
        providersConfig: newProvidersConfig,
        read: newReadConfig,
        translate: newTranslateConfig,
    };
}
