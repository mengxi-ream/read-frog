import type { Config } from '@/types/config/config'
import { isLLMProvider, isTranslateProvider } from '@/types/config/provider'
import { getProviderConfigById } from '../config/helpers'

export interface FeatureProviderDef {
  nullable: boolean
  getProviderId: (config: Config) => string | null
  configPath: string[]
  isProvider: (provider: string) => boolean
}

export const FEATURE_PROVIDER_DEFS = {
  'translate': {
    isProvider: isTranslateProvider,
    nullable: false,
    getProviderId: (c: Config) => c.translate.providerId,
    configPath: ['translate', 'providerId'],
  },
  'videoSubtitles': {
    isProvider: isTranslateProvider,
    nullable: false,
    getProviderId: (c: Config) => c.videoSubtitles.providerId,
    configPath: ['videoSubtitles', 'providerId'],
  },
  'selectionToolbar.translate': {
    isProvider: isTranslateProvider,
    nullable: false,
    getProviderId: (c: Config) => c.selectionToolbar.features.translate.providerId,
    configPath: ['selectionToolbar', 'features', 'translate', 'providerId'],
  },
  'selectionToolbar.vocabularyInsight': {
    isProvider: isLLMProvider,
    nullable: false,
    getProviderId: (c: Config) => c.selectionToolbar.features.vocabularyInsight.providerId,
    configPath: ['selectionToolbar', 'features', 'vocabularyInsight', 'providerId'],
  },
  'tts': {
    isProvider: isLLMProvider,
    nullable: true, // TODO: remove nullable once we have Edge TTS provider
    getProviderId: (c: Config) => c.tts.providerId,
    configPath: ['tts', 'providerId'],
  },
  'inputTranslation': {
    isProvider: isTranslateProvider,
    nullable: false,
    getProviderId: (c: Config) => c.inputTranslation.providerId,
    configPath: ['inputTranslation', 'providerId'],
  },
} as const satisfies Record<string, FeatureProviderDef>

export type FeatureKey = keyof typeof FEATURE_PROVIDER_DEFS

/** Maps FeatureKey (with dots) to i18n-safe key (with underscores) for `options.general.featureProviders.features.*` */
export const FEATURE_KEY_I18N_MAP: Record<FeatureKey, string> = {
  'translate': 'translate',
  'videoSubtitles': 'videoSubtitles',
  'selectionToolbar.translate': 'selectionToolbar_translate',
  'selectionToolbar.vocabularyInsight': 'selectionToolbar_vocabularyInsight',
  'tts': 'tts',
  'inputTranslation': 'inputTranslation',
}

export function resolveProviderConfig(config: Config, featureKey: keyof typeof FEATURE_PROVIDER_DEFS) {
  const def = FEATURE_PROVIDER_DEFS[featureKey]
  const providerId = def.getProviderId(config)
  if (!providerId) {
    throw new Error(`No provider id for feature "${featureKey}"`)
  }
  const providerConfig = getProviderConfigById(config.providersConfig, providerId)
  if (!providerConfig) {
    throw new Error(`No provider config for id "${providerId}" (feature "${featureKey}")`)
  }
  return providerConfig
}
