import type { PartialDeep } from 'type-fest'
import type { LLMTranslateProviderConfig, ProviderConfig } from '@/types/config/provider'
import { deepmerge } from 'deepmerge-ts'
import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import { llmProviderConfigItemSchema, providerConfigItemSchema } from '@/types/config/provider'
import { getProviderConfigById, getReadProvidersConfig, getTranslateProvidersConfig, getTTSProvidersConfig } from '../config/helpers'
import { configFieldsAtomMap } from './config'

// Derived atom for read provider config
export const readProviderConfigAtom = atom(
  (get) => {
    const readConfig = get(configFieldsAtomMap.read)
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const readProvidersConfig = getReadProvidersConfig(providersConfig)
    const providerConfig = getProviderConfigById(readProvidersConfig, readConfig.providerId)
    if (!providerConfig) {
      throw new Error(`Provider ${readConfig.providerId} not found`)
    }
    return providerConfig
  },
  async (get, set, newProviderConfig: LLMTranslateProviderConfig) => {
    const readConfig = get(configFieldsAtomMap.read)
    const providersConfig = get(configFieldsAtomMap.providersConfig)

    const updatedProviders = providersConfig.map(provider =>
      provider.id === readConfig.providerId ? newProviderConfig : provider,
    )

    await set(configFieldsAtomMap.providersConfig, updatedProviders)
  },
)

// Derived atom for translate provider config
export const translateProviderConfigAtom = atom(
  (get) => {
    const translateConfig = get(configFieldsAtomMap.translate)
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const translateProvidersConfig = getTranslateProvidersConfig(providersConfig)
    const providerConfig = getProviderConfigById(translateProvidersConfig, translateConfig.providerId)
    if (!providerConfig) {
      throw new Error(`Provider ${translateConfig.providerId} not found`)
    }

    return providerConfig
  },
  async (get, set, newProviderConfig: ProviderConfig) => {
    const translateConfig = get(configFieldsAtomMap.translate)
    const providersConfig = get(configFieldsAtomMap.providersConfig)

    const updatedProviders = providersConfig.map(provider =>
      provider.id === translateConfig.providerId ? newProviderConfig : provider,
    )

    await set(configFieldsAtomMap.providersConfig, updatedProviders)
  },
)

export const ttsProviderConfigAtom = atom(
  (get) => {
    const ttsConfig = get(configFieldsAtomMap.tts)
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const ttsProvidersConfig = getTTSProvidersConfig(providersConfig)
    if (ttsConfig.providerId) {
      return getProviderConfigById(ttsProvidersConfig, ttsConfig.providerId)
    }
    return undefined
  },
  async (get, set, newProviderConfig: ProviderConfig) => {
    const ttsConfig = get(configFieldsAtomMap.tts)
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const updatedProviders = providersConfig.map(provider =>
      provider.id === ttsConfig.providerId ? newProviderConfig : provider,
    )
    await set(configFieldsAtomMap.providersConfig, updatedProviders)
  },
)

// Generic provider config atom family that accepts a name parameter
export const providerConfigAtom = atomFamily((id: string) =>
  atom(
    (get) => {
      const providersConfig = get(configFieldsAtomMap.providersConfig)
      return getProviderConfigById(providersConfig, id)
    },
    async (get, set, newProviderConfig: ProviderConfig) => {
      const providersConfig = get(configFieldsAtomMap.providersConfig)

      const updatedProviders = providersConfig.map(provider =>
        provider.id === id ? newProviderConfig : provider,
      )

      await set(configFieldsAtomMap.providersConfig, updatedProviders)
    },
  ),
)

export function updateLLMProviderConfig(
  config: LLMTranslateProviderConfig,
  updates: PartialDeep<LLMTranslateProviderConfig>,
): LLMTranslateProviderConfig {
  // @ts-expect-error - Type instantiation too deep due to complex provider union types
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
