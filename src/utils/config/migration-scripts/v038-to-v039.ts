/**
 * Migration script from v038 to v039
 * Renames provider keys to match AI SDK expectations:
 * - 'gemini' -> 'google'
 * - 'grok' -> 'xai'
 * - 'amazonBedrock' -> 'bedrock'
 * - 'openaiCompatible' -> 'openai-compatible'
 * - 'google' (translation) -> 'google-translate'
 * - 'microsoft' (translation) -> 'microsoft-translate'
 *
 * Before (v038):
 *   { providersConfig: [{ provider: 'gemini', ... }, { provider: 'google', ... }], ... }
 *
 * After (v039):
 *   { providersConfig: [{ provider: 'google', ... }, { provider: 'google-translate', ... }], ... }
 */

const PROVIDER_KEY_MIGRATION: Record<string, string> = {
  gemini: 'google',
  grok: 'xai',
  amazonBedrock: 'bedrock',
  openaiCompatible: 'openai-compatible',
  google: 'google-translate',
  microsoft: 'microsoft-translate',
}

const PROVIDER_ID_MIGRATION: Record<string, string> = {
  'gemini-default': 'google-default',
  'xai-default': 'xai-default',
  'amazon-bedrock-default': 'bedrock-default',
  'openai-compatible-default': 'openai-compatible-default',
  'google-default': 'google-translate-default',
  'microsoft-default': 'microsoft-translate-default',
}

export function migrate(oldConfig: any): any {
  const newProvidersConfig = oldConfig.providersConfig.map((provider: any) => {
    const newProviderKey = PROVIDER_KEY_MIGRATION[provider.provider]
    const newProviderId = PROVIDER_ID_MIGRATION[provider.id]
    if (newProviderKey || newProviderId) {
      return {
        ...provider,
        ...(newProviderKey && { provider: newProviderKey }),
        ...(newProviderId && { id: newProviderId }),
      }
    }
    return provider
  })

  // Update translate.providerId if it references an old ID
  const newTranslateProviderId = PROVIDER_ID_MIGRATION[oldConfig.translate?.providerId] ?? oldConfig.translate?.providerId

  // Update read.providerId if it references an old ID
  const newReadProviderId = PROVIDER_ID_MIGRATION[oldConfig.read?.providerId] ?? oldConfig.read?.providerId

  return {
    ...oldConfig,
    providersConfig: newProvidersConfig,
    translate: {
      ...oldConfig.translate,
      providerId: newTranslateProviderId,
    },
    read: {
      ...oldConfig.read,
      providerId: newReadProviderId,
    },
  }
}
