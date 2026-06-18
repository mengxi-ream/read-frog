export function migrate(oldConfig) {
    const oldProvidersConfig = oldConfig.providersConfig;
    const newProvidersConfig = Object.fromEntries(Object.entries(oldProvidersConfig).map(([key, value]) => {
        const baseURLs = {
            openai: "https://api.openai.com/v1",
            deepseek: "https://api.deepseek.com/v1",
            openrouter: "https://openrouter.ai/api/v1",
        };
        return [key, {
                ...value,
                baseURL: baseURLs[key],
            }];
    }));
    return {
        ...oldConfig,
        providersConfig: newProvidersConfig,
    };
}
