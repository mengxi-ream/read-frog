/**
 * Migration script from v072 to v073
 * - Adds selectionTranslation config section.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */

const NON_API_TRANSLATE_PROVIDERS = ["google-translate", "microsoft-translate", "deeplx", "deepl"]
const NON_API_TRANSLATE_PROVIDER_IDS: Record<string, string> = {
  "google-translate": "google-translate-default",
  "microsoft-translate": "microsoft-translate-default",
  "deeplx": "deeplx-default",
  "deepl": "deepl-default",
}

function resolveSelectionTranslationProviderId(oldConfig: any): string {
  const providersConfig = oldConfig?.providersConfig
  if (!Array.isArray(providersConfig)) {
    return "google-translate-default"
  }

  const providerIds = new Set(providersConfig.map((p: any) => p.id))

  // Prefer google-translate-default if available
  if (providerIds.has("google-translate-default")) {
    return "google-translate-default"
  }

  // Try other non-API translate providers
  for (const [_providerType, defaultId] of Object.entries(NON_API_TRANSLATE_PROVIDER_IDS)) {
    if (providerIds.has(defaultId)) {
      return defaultId
    }
  }

  // Fall back to the existing translate.providerId if it's a valid translate provider
  const translateProviderId = oldConfig?.translate?.providerId
  if (typeof translateProviderId === "string" && providerIds.has(translateProviderId)) {
    const provider = providersConfig.find((p: any) => p.id === translateProviderId)
    if (provider && NON_API_TRANSLATE_PROVIDERS.includes(provider.provider)) {
      return translateProviderId
    }
  }

  // Fall back to any enabled translate provider in providersConfig
  for (const provider of providersConfig) {
    if (provider.enabled && NON_API_TRANSLATE_PROVIDERS.includes(provider.provider)) {
      return provider.id
    }
  }

  // Last resort: use the existing translate.providerId (LLM providers are valid too)
  if (typeof translateProviderId === "string" && providerIds.has(translateProviderId)) {
    return translateProviderId
  }

  // Use first enabled provider that can translate
  for (const provider of providersConfig) {
    if (provider.enabled) {
      return provider.id
    }
  }

  return "google-translate-default"
}

export function migrate(oldConfig: any): any {
  const providerId = resolveSelectionTranslationProviderId(oldConfig)

  return {
    ...oldConfig,
    selectionTranslation: {
      enabled: true,
      triggerMode: "toolbar",
      providerId,
      autoPronunciation: false,
      disabledSites: [],
    },
  }
}
