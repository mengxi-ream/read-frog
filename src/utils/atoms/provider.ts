import type { PartialDeep } from "type-fest"
import type { FeatureKey } from "../constants/feature-providers"
import type { LLMProviderConfig, ProviderConfig } from "@/types/config/provider"
import { deepmerge } from "deepmerge-ts"
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { llmProviderConfigItemSchema, providerConfigItemSchema } from "@/types/config/provider"
import { getProviderConfigById } from "../config/helpers"
import { FEATURE_PROVIDER_DEFS } from "../constants/feature-providers"
import { configAtom, configFieldsAtomMap } from "./config"

export const featureProviderConfigAtom = atomFamily((featureKey: FeatureKey) =>
  atom((get) => {
    const config = get(configAtom)
    const def = FEATURE_PROVIDER_DEFS[featureKey]
    const providerId = def.getProviderId(config)
    return getProviderConfigById(config.providersConfig, providerId) ?? null
  }),
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
  config: LLMProviderConfig,
  updates: PartialDeep<LLMProviderConfig>,
): LLMProviderConfig {
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
