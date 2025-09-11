import type { PartialDeep } from 'type-fest'
import type { LLMTranslateProviderConfig, ProviderConfig } from '@/types/config/provider'
import { deepmerge } from 'deepmerge-ts'
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { llmProviderConfigItemSchema, providerConfigItemSchema } from '@/types/config/provider'
import { getLLMTranslateProvidersConfig, getProviderConfigByName } from '../config/helpers'
import { configFields } from './config'

// Derived atom for read provider config
export const readProviderConfigAtom = atom(
  (get) => {
    const readConfig = get(configFields.read)
    const providersConfig = get(configFields.providersConfig)
    const LLMProvidersConfig = getLLMTranslateProvidersConfig(providersConfig)
    const providerConfig = getProviderConfigByName(LLMProvidersConfig, readConfig.providerName)
    if (!providerConfig) {
      throw new Error(`Provider ${readConfig.providerName} not found`)
    }
    return providerConfig
  },
  (get, set, newProviderConfig: LLMTranslateProviderConfig) => {
    const readConfig = get(configFields.read)
    const providersConfig = get(configFields.providersConfig)

    const updatedProviders = providersConfig.map(provider =>
      provider.name === readConfig.providerName ? newProviderConfig : provider,
    )

    set(configFields.providersConfig, updatedProviders)
  },
)

// Derived atom for translate provider config
export const translateProviderConfigAtom = atom(
  (get) => {
    const translateConfig = get(configFields.translate)
    const providersConfig = get(configFields.providersConfig)

    const providerConfig = getProviderConfigByName(providersConfig, translateConfig.providerName)
    if (providerConfig)
      return providerConfig

    // Non API translate providers (google, microsoft) don't have config
    return undefined
  },
  (get, set, newProviderConfig: ProviderConfig) => {
    const translateConfig = get(configFields.translate)
    const providersConfig = get(configFields.providersConfig)

    const updatedProviders = providersConfig.map(provider =>
      provider.name === translateConfig.providerName ? newProviderConfig : provider,
    )

    set(configFields.providersConfig, updatedProviders)
  },
)

// Generic provider config atom family that accepts a name parameter
export const providerConfigAtom = atomFamily((name: string) =>
  atom(
    (get) => {
      const providersConfig = get(configFields.providersConfig)
      return getProviderConfigByName(providersConfig, name)
    },
    (get, set, newProviderConfig: ProviderConfig) => {
      const providersConfig = get(configFields.providersConfig)

      const updatedProviders = providersConfig.map(provider =>
        provider.name === name ? newProviderConfig : provider,
      )

      set(configFields.providersConfig, updatedProviders)
    },
  ),
)

export function updateLLMProviderConfig(
  config: LLMTranslateProviderConfig,
  updates: PartialDeep<LLMTranslateProviderConfig>,
): LLMTranslateProviderConfig {
  const result = deepmerge(config, updates)
  return llmProviderConfigItemSchema.parse(result)
}

export function updateProviderConfig(
  config: ProviderConfig,
  updates: PartialDeep<ProviderConfig>,
): ProviderConfig {
  const result = deepmerge(config, updates)
  return providerConfigItemSchema.parse(result)
}
