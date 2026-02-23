import type { Config } from '@/types/config/config'
import { isLLMProvider, isTranslateProvider } from '@/types/config/provider'
import { mergeWithArrayOverwrite } from '../atoms/config'
import { getProviderConfigById } from '../config/helpers'

export const FEATURE_KEYS = [
  'translate',
  'videoSubtitles',
  'selectionToolbar.translate',
  'selectionToolbar.vocabularyInsight',
  'inputTranslation',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export interface FeatureProviderDef {
  getProviderId: (config: Config) => string
  configPath: readonly string[]
  isProvider: (provider: string) => boolean
}

export const FEATURE_PROVIDER_DEFS = {
  'translate': {
    isProvider: isTranslateProvider,
    getProviderId: (c: Config) => c.translate.providerId,
    configPath: ['translate', 'providerId'],
  },
  'videoSubtitles': {
    isProvider: isTranslateProvider,
    getProviderId: (c: Config) => c.videoSubtitles.providerId,
    configPath: ['videoSubtitles', 'providerId'],
  },
  'selectionToolbar.translate': {
    isProvider: isTranslateProvider,
    getProviderId: (c: Config) => c.selectionToolbar.features.translate.providerId,
    configPath: ['selectionToolbar', 'features', 'translate', 'providerId'],
  },
  'selectionToolbar.vocabularyInsight': {
    isProvider: isLLMProvider,
    getProviderId: (c: Config) => c.selectionToolbar.features.vocabularyInsight.providerId,
    configPath: ['selectionToolbar', 'features', 'vocabularyInsight', 'providerId'],
  },
  'inputTranslation': {
    isProvider: isTranslateProvider,
    getProviderId: (c: Config) => c.inputTranslation.providerId,
    configPath: ['inputTranslation', 'providerId'],
  },
} as const satisfies Record<FeatureKey, FeatureProviderDef>

/** Maps FeatureKey (with dots) to i18n-safe key (with underscores) for `options.general.featureProviders.features.*` */
export const FEATURE_KEY_I18N_MAP: Record<FeatureKey, string> = {
  'translate': 'translate',
  'videoSubtitles': 'videoSubtitles',
  'selectionToolbar.translate': 'selectionToolbar_translate',
  'selectionToolbar.vocabularyInsight': 'selectionToolbar_vocabularyInsight',
  'inputTranslation': 'inputTranslation',
}

export function resolveProviderConfig(config: Config, featureKey: FeatureKey) {
  const def = FEATURE_PROVIDER_DEFS[featureKey]
  const providerId = def.getProviderId(config)
  const providerConfig = getProviderConfigById(config.providersConfig, providerId)
  if (!providerConfig) {
    throw new Error(`No provider config for id "${providerId}" (feature "${featureKey}")`)
  }
  return providerConfig
}

/**
 * Convert a feature→providerId mapping into a Partial<Config> using FEATURE_PROVIDER_DEFS.configPath.
 * Generic — works for any scenario that assigns provider IDs to features.
 */

export function buildFeatureProviderPatch(
  assignments: Partial<Record<FeatureKey, string>>,
): Partial<Config> {
  let patch: Record<string, unknown> = {}

  for (const key of FEATURE_KEYS) {
    const newId = assignments[key]
    if (newId === undefined)
      continue

    const def = FEATURE_PROVIDER_DEFS[key]

    const fragment: Record<string, unknown> = {}
    let current: Record<string, unknown> = fragment
    for (let i = 0; i < def.configPath.length - 1; i++) {
      const next: Record<string, unknown> = {}
      current[def.configPath[i]] = next
      current = next
    }
    current[def.configPath[def.configPath.length - 1]] = newId

    patch = mergeWithArrayOverwrite(patch, fragment)
  }

  return patch as Partial<Config>
}
