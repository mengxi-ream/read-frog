/** Add the free Bilibili provider without changing existing provider selections. */
export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || !Array.isArray(oldConfig.providersConfig)) {
    return oldConfig
  }
  if (
    oldConfig.providersConfig?.some((provider: any) => provider.provider === "bilibili-translate")
  ) {
    return oldConfig
  }

  // Frozen snapshot: do not import current provider defaults here.
  const providers = oldConfig.providersConfig ?? []
  let id = "bilibili-translate-default"
  while (providers.some((provider: any) => provider.id === id)) {
    id += "-new"
  }
  return {
    ...oldConfig,
    providersConfig: [
      ...providers,
      {
        id,
        name: "Bilibili Index Translate",
        enabled: true,
        provider: "bilibili-translate",
        description:
          "Free Bilibili Index model for translation and AI features; no API key required",
        baseURL: "https://index-translate.bilibili.com/v1",
        model: { model: "Index-Translate-35B-A3B", isCustomModel: false, customModel: null },
      },
    ],
  }
}
