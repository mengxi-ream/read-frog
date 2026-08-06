/**
 * Migration script from v092 to v093.
 *
 * Microsoft translation moved to the unauthenticated
 * edge.microsoft.com/translate/translatetext endpoint after the token
 * endpoint of the old flow was removed upstream. The new endpoint has no
 * markup-preserving mode, so translationOnly page mode can no longer run on
 * Microsoft, and the UI now blocks that combination from forming. Configs
 * that already pair them are rewritten here: the page-translate provider
 * moves to an enabled Google Translate entry, or — when the config has no
 * enabled Google Translate provider left — the mode falls back to bilingual.
 *
 * IMPORTANT: All ids and helpers are frozen inline. Migration scripts must not
 * import constants or utilities from the evolving application code.
 */

const MICROSOFT_TRANSLATE_PROVIDER_TYPE = "microsoft-translate"
const GOOGLE_TRANSLATE_PROVIDER_TYPE = "google-translate"
const GOOGLE_TRANSLATE_DEFAULT_ID = "google-translate-default"

function isRecord(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isRecord(oldConfig)) {
    return oldConfig
  }

  const translate = oldConfig.translate
  if (!isRecord(translate) || translate.mode !== "translationOnly") {
    return oldConfig
  }

  const providersConfig = Array.isArray(oldConfig.providersConfig) ? oldConfig.providersConfig : []
  const assignedProvider = providersConfig.find(
    (provider: any) => isRecord(provider) && provider.id === translate.providerId,
  )
  if (
    !isRecord(assignedProvider) ||
    assignedProvider.provider !== MICROSOFT_TRANSLATE_PROVIDER_TYPE
  ) {
    return oldConfig
  }

  // The schema requires the assigned provider to be enabled, so only enabled
  // Google entries qualify as a replacement target.
  const enabledGoogleProviders = providersConfig.filter(
    (provider: any) =>
      isRecord(provider) &&
      provider.provider === GOOGLE_TRANSLATE_PROVIDER_TYPE &&
      provider.enabled === true &&
      typeof provider.id === "string",
  )
  const googleProvider =
    enabledGoogleProviders.find((provider: any) => provider.id === GOOGLE_TRANSLATE_DEFAULT_ID) ??
    enabledGoogleProviders[0]

  if (googleProvider) {
    return {
      ...oldConfig,
      translate: {
        ...translate,
        providerId: googleProvider.id,
      },
    }
  }

  return {
    ...oldConfig,
    translate: {
      ...translate,
      mode: "bilingual",
    },
  }
}
