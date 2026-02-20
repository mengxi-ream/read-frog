/**
 * Migration script from v052 to v053
 *
 * 1) Unify provider model configuration:
 *    - before: provider.models.read + provider.models.translate
 *    - after:  provider.model
 * 2) Remove obsolete `read` config block
 * 3) Add selectionToolbar feature-level provider config
 */

const LLM_PROVIDER_TYPES = [
  'openai',
  'deepseek',
  'google',
  'anthropic',
  'xai',
  'openai-compatible',
  'siliconflow',
  'tensdaq',
  'ai302',
  'bedrock',
  'groq',
  'deepinfra',
  'mistral',
  'togetherai',
  'cohere',
  'fireworks',
  'cerebras',
  'replicate',
  'perplexity',
  'vercel',
  'openrouter',
  'ollama',
  'volcengine',
  'minimax',
] as const

const TRANSLATE_PROVIDER_TYPES = [
  'google-translate',
  'microsoft-translate',
  'deeplx',
  ...LLM_PROVIDER_TYPES,
] as const

interface SelectionToolbarFeatureConfig {
  providerId: string
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isTranslateProviderName(providerName: unknown): boolean {
  return typeof providerName === 'string' && TRANSLATE_PROVIDER_TYPES.includes(providerName as (typeof TRANSLATE_PROVIDER_TYPES)[number])
}

function isLLMProviderName(providerName: unknown): boolean {
  return typeof providerName === 'string' && LLM_PROVIDER_TYPES.includes(providerName as (typeof LLM_PROVIDER_TYPES)[number])
}

function migrateProviderModel(provider: any): any {
  if (!isObject(provider)) {
    return provider
  }

  const hasUnifiedModel = isObject(provider.model)
  if (hasUnifiedModel) {
    const { models, ...rest } = provider
    return rest
  }

  const translateModel = provider.models?.translate
  if (isObject(translateModel)) {
    const { models, ...rest } = provider
    return {
      ...rest,
      model: translateModel,
    }
  }

  const { models, ...rest } = provider
  return rest
}

function migrateProviderModels(providersConfig: unknown): any[] {
  if (!Array.isArray(providersConfig)) {
    return []
  }

  return providersConfig.map(migrateProviderModel)
}

function getTranslateProviderIds(providersConfig: any[]): string[] {
  return providersConfig
    .filter(provider => isObject(provider)
      && typeof provider.id === 'string'
      && isTranslateProviderName(provider.provider))
    .map(provider => provider.id)
}

function getLLMProviderIds(providersConfig: any[]): string[] {
  return providersConfig
    .filter(provider => isObject(provider)
      && typeof provider.id === 'string'
      && isLLMProviderName(provider.provider))
    .map(provider => provider.id)
}

function resolveTranslateProviderId(oldConfig: any, translateProviderIds: string[]): string {
  const configuredProviderId = oldConfig?.translate?.providerId
  if (typeof configuredProviderId === 'string' && translateProviderIds.includes(configuredProviderId)) {
    return configuredProviderId
  }

  return translateProviderIds[0] ?? 'microsoft-translate-default'
}

function resolveVocabularyInsightProviderId(oldConfig: any, fallbackProviderId: string, llmProviderIds: string[]): string {
  // Prefer legacy read provider (vocabulary insight is the successor to read)
  const readProviderId = oldConfig?.read?.providerId
  if (typeof readProviderId === 'string' && llmProviderIds.includes(readProviderId)) {
    return readProviderId
  }

  if (llmProviderIds.includes(fallbackProviderId)) {
    return fallbackProviderId
  }

  return llmProviderIds[0] ?? fallbackProviderId
}

function normalizeFeatureConfig(
  rawFeatureConfig: unknown,
  fallbackProviderId: string,
  allowedProviderIds: string[],
): SelectionToolbarFeatureConfig {
  const providerId = isObject(rawFeatureConfig) && typeof rawFeatureConfig.providerId === 'string' && allowedProviderIds.includes(rawFeatureConfig.providerId)
    ? rawFeatureConfig.providerId
    : fallbackProviderId

  return {
    providerId,
  }
}

function migrateSelectionToolbarFeatures(oldConfig: any, providersConfig: any[]) {
  const oldSelectionToolbar = isObject(oldConfig?.selectionToolbar) ? oldConfig.selectionToolbar : {}
  const oldFeatures = isObject(oldSelectionToolbar.features) ? oldSelectionToolbar.features : {}

  const translateProviderIds = getTranslateProviderIds(providersConfig)
  const llmProviderIds = getLLMProviderIds(providersConfig)

  const defaultTranslateProviderId = resolveTranslateProviderId(oldConfig, translateProviderIds)
  const defaultVocabularyInsightProviderId = resolveVocabularyInsightProviderId(oldConfig, defaultTranslateProviderId, llmProviderIds)

  const features = {
    translate: normalizeFeatureConfig(
      oldFeatures.translate,
      defaultTranslateProviderId,
      translateProviderIds,
    ),
    vocabularyInsight: normalizeFeatureConfig(
      oldFeatures.vocabularyInsight,
      defaultVocabularyInsightProviderId,
      llmProviderIds,
    ),
  }

  return {
    enabled: oldSelectionToolbar.enabled ?? true,
    disabledSelectionToolbarPatterns: Array.isArray(oldSelectionToolbar.disabledSelectionToolbarPatterns)
      ? oldSelectionToolbar.disabledSelectionToolbarPatterns
      : [],
    features,
  }
}

function reorderProviders(providersConfig: any[]): any[] {
  const msIndex = providersConfig.findIndex(p => isObject(p) && p.provider === 'microsoft-translate')
  const googleIndex = providersConfig.findIndex(p => isObject(p) && p.provider === 'google-translate')

  if (msIndex === -1 || googleIndex === -1 || msIndex < googleIndex) {
    return providersConfig
  }

  const result = [...providersConfig]
  const [msEntry] = result.splice(msIndex, 1)
  result.splice(googleIndex, 0, msEntry)
  return result
}

function removeReadConfig(oldConfig: any) {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const { read: _removedRead, ...rest } = oldConfig
  return rest
}

function migrateInputTranslation(oldConfig: any, translateProviderIds: string[]): any {
  const inputTranslation = isObject(oldConfig?.inputTranslation) ? oldConfig.inputTranslation : {}
  if (typeof inputTranslation.providerId === 'string' && inputTranslation.providerId) {
    return inputTranslation
  }
  const providerId = resolveTranslateProviderId(oldConfig, translateProviderIds)
  return { ...inputTranslation, providerId }
}

function migrateVideoSubtitles(oldConfig: any, translateProviderIds: string[]): any {
  const videoSubtitles = isObject(oldConfig?.videoSubtitles) ? oldConfig.videoSubtitles : {}
  if (typeof videoSubtitles.providerId === 'string' && videoSubtitles.providerId) {
    return videoSubtitles
  }
  const providerId = resolveTranslateProviderId(oldConfig, translateProviderIds)
  return { ...videoSubtitles, providerId }
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const configWithoutRead = removeReadConfig(oldConfig)
  const migratedProvidersConfig = reorderProviders(migrateProviderModels(configWithoutRead.providersConfig))
  const translateProviderIds = getTranslateProviderIds(migratedProvidersConfig)

  return {
    ...configWithoutRead,
    providersConfig: migratedProvidersConfig,
    selectionToolbar: migrateSelectionToolbarFeatures(oldConfig, migratedProvidersConfig),
    inputTranslation: migrateInputTranslation(configWithoutRead, translateProviderIds),
    videoSubtitles: migrateVideoSubtitles(configWithoutRead, translateProviderIds),
  }
}
