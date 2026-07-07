import type { GeneratedI18nStructure } from "#i18n"
import type { ProviderConfig, ProvidersConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import type { ProviderSelectorItem, ProviderSelectorOption } from "@/utils/providers/provider-display"
import readFrogLogo from "@/assets/providers/read-frog-provider.png?url&no-inline"
import { isLLMProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import { i18n } from "@/utils/i18n"

export const FREE_AI_PROVIDER_ID = "read-frog-free-ai"
export const FREE_AI_PROVIDER_LOGO = readFrogLogo

const FREE_AI_PROVIDER_NAME_KEY = "options.apiProviders.providers.name.freeAi"
const FREE_AI_PROVIDER_FALLBACK_NAME = "Free AI Service"

export type ProviderCapability = FeatureKey | "selectionToolbar.customAction"
type SystemProviderNameKey = keyof GeneratedI18nStructure
type ProviderConfigPredicate<T extends ProviderConfig = ProviderConfig> = (provider: ProviderConfig) => provider is T

interface SystemProviderDef {
  id: string
  nameKey: SystemProviderNameKey
  fallbackName: string
  capabilities: readonly ProviderCapability[]
  logo: (theme: Theme) => string
}

export interface LocalProviderRef<T extends ProviderConfig = ProviderConfig> {
  kind: "local"
  config: T
  id: string
  name: string
}

export interface SystemProviderRef {
  kind: "system"
  id: string
  name: string
}

export type ResolvedProviderRef<T extends ProviderConfig = ProviderConfig>
  = | LocalProviderRef<T>
    | SystemProviderRef

const SYSTEM_PROVIDER_DEFS = {
  [FREE_AI_PROVIDER_ID]: {
    id: FREE_AI_PROVIDER_ID,
    nameKey: FREE_AI_PROVIDER_NAME_KEY,
    fallbackName: FREE_AI_PROVIDER_FALLBACK_NAME,
    capabilities: ["selectionToolbar.customAction"],
    logo: () => FREE_AI_PROVIDER_LOGO,
  },
} as const satisfies Record<string, SystemProviderDef>

const LOCAL_PROVIDER_CAPABILITY_PREDICATES = {
  "translate": isTranslateProviderConfig,
  "videoSubtitles": isTranslateProviderConfig,
  "selectionToolbar.translate": isTranslateProviderConfig,
  "inputTranslation": isTranslateProviderConfig,
  "selectionToolbar.customAction": isLLMProviderConfig,
} as const satisfies Record<ProviderCapability, ProviderConfigPredicate>

export type ProviderConfigForCapability<C extends ProviderCapability>
  = (typeof LOCAL_PROVIDER_CAPABILITY_PREDICATES)[C] extends ProviderConfigPredicate<infer T>
    ? T
    : never

export type ProviderRefForCapability<C extends ProviderCapability>
  = ResolvedProviderRef<ProviderConfigForCapability<C>>

export type CustomActionProviderRef = ProviderRefForCapability<"selectionToolbar.customAction">
export type SelectionToolbarTranslateProviderRef = ProviderRefForCapability<"selectionToolbar.translate">

function getSystemProviderName(def: SystemProviderDef): string {
  return i18n.t(def.nameKey as never) || def.fallbackName
}

function createSystemProviderSelectorItem(def: SystemProviderDef): ProviderSelectorItem {
  return {
    kind: "system",
    id: def.id,
    name: getSystemProviderName(def),
    logo: def.logo,
  }
}

function createSystemProviderRef(def: SystemProviderDef): SystemProviderRef {
  return {
    kind: "system",
    id: def.id,
    name: getSystemProviderName(def),
  }
}

function getSystemProviderDef(providerId: string): SystemProviderDef | undefined {
  return Object.values(SYSTEM_PROVIDER_DEFS).find(def => def.id === providerId)
}

export function isFreeAiProviderId(providerId: string): providerId is typeof FREE_AI_PROVIDER_ID {
  return providerId === FREE_AI_PROVIDER_ID
}

export function isSystemProviderId(providerId: string): boolean {
  return !!getSystemProviderDef(providerId)
}

export function getLocalProviderPredicateForCapability<C extends ProviderCapability>(
  capability: C,
): ProviderConfigPredicate<ProviderConfigForCapability<C>> {
  return LOCAL_PROVIDER_CAPABILITY_PREDICATES[capability] as ProviderConfigPredicate<ProviderConfigForCapability<C>>
}

export function isLocalProviderConfigCompatibleWithCapability<C extends ProviderCapability>(
  capability: C,
  providerConfig: ProviderConfig,
): providerConfig is ProviderConfigForCapability<C> {
  return getLocalProviderPredicateForCapability(capability)(providerConfig)
}

export function getSystemProviderIdsForCapability(capability: ProviderCapability): string[] {
  return Object.values(SYSTEM_PROVIDER_DEFS)
    .filter(def => def.capabilities.includes(capability))
    .map(def => def.id)
}

export function doesProviderSupportsCapability(
  capability: ProviderCapability,
  providersConfig: ProvidersConfig,
  providerId: string,
  options: { requireEnable?: boolean } = {},
): boolean {
  const providerConfig = providersConfig.find(provider => provider.id === providerId)
  if (providerConfig) {
    return (!options.requireEnable || providerConfig.enabled)
      && isLocalProviderConfigCompatibleWithCapability(capability, providerConfig)
  }

  const systemProvider = getSystemProviderDef(providerId)
  return !!systemProvider?.capabilities.includes(capability)
}

export function getProviderIdsForCapability(
  capability: ProviderCapability,
  providersConfig: ProvidersConfig,
  options: { requireEnable?: boolean } = {},
): string[] {
  const localIds = providersConfig
    .filter(provider =>
      (!options.requireEnable || provider.enabled)
      && isLocalProviderConfigCompatibleWithCapability(capability, provider),
    )
    .map(provider => provider.id)

  return [
    ...localIds,
    ...getSystemProviderIdsForCapability(capability),
  ]
}

export function getSelectableProvidersForCapability(
  capability: ProviderCapability,
  providersConfig: ProvidersConfig,
): ProviderSelectorOption[] {
  const systemProviders = Object.values(SYSTEM_PROVIDER_DEFS)
    .filter(def => def.capabilities.includes(capability))
    .map(createSystemProviderSelectorItem)

  const localProviders = providersConfig.filter(provider =>
    provider.enabled && isLocalProviderConfigCompatibleWithCapability(capability, provider),
  )

  return [
    ...systemProviders,
    ...localProviders,
  ]
}

export function resolveProviderRefForCapability<C extends ProviderCapability>(
  capability: C,
  providersConfig: ProvidersConfig,
  providerId: string,
): ProviderRefForCapability<C> | null {
  const providerConfig = providersConfig.find(provider => provider.id === providerId)
  if (providerConfig) {
    if (!isLocalProviderConfigCompatibleWithCapability(capability, providerConfig)) {
      return null
    }

    return {
      kind: "local",
      config: providerConfig,
      id: providerConfig.id,
      name: providerConfig.name,
    }
  }

  const systemProvider = getSystemProviderDef(providerId)
  if (!systemProvider?.capabilities.includes(capability)) {
    return null
  }

  return createSystemProviderRef(systemProvider)
}
