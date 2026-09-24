/** Frozen v101 → v102 snapshot. Hub preferences are independent of page translation. */
export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  const hub = oldConfig.translationHub
  if (!hub || typeof hub !== "object" || Array.isArray(hub)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    translationHub: {
      ...hub,
      selectedProviderIds: hub.selectedProviderIds ?? null,
      sourceCode: hub.sourceCode ?? null,
      targetCode: hub.targetCode ?? null,
      promptId:
        hub.promptId ?? oldConfig.pageTranslation?.customPromptsConfig?.promptId ?? "default",
    },
  }
}
