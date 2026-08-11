import type { GeneratedI18nStructure } from "#i18n"
import type { ProviderConfig, ProvidersConfig } from "@/types/config/provider"
import type { Theme } from "@/types/config/theme"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import type {
  ProviderSelectorItem,
  ProviderSelectorOption,
} from "@/utils/providers/provider-display"
import readFrogLogo from "@/assets/providers/read-frog-provider.png?url&no-inline"
import { isLLMProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_PROVIDER_IDS,
  BUILT_IN_AI_ULTRA_PROVIDER_ID,
  type BuiltInAiProviderId,
  type HostedAiModelTier,
} from "@/utils/constants/provider-ids"
import { i18n } from "@/utils/i18n"

export {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_ULTRA_PROVIDER_ID,
} from "@/utils/constants/provider-ids"
export const BUILT_IN_AI_PROVIDER_LOGO = readFrogLogo

const BUILT_IN_AI_PROVIDER_NAME_KEY = "options.apiProviders.providers.name.builtInAi"
const BUILT_IN_AI_PROVIDER_FALLBACK_NAME = "Built-in AI"
const BUILT_IN_AI_ULTRA_PROVIDER_NAME_KEY = "options.apiProviders.providers.name.builtInAiUltra"
const BUILT_IN_AI_ULTRA_PROVIDER_FALLBACK_NAME = "Advanced Built-in AI"

export type ProviderCapability = FeatureKey | "customAction"
type SystemProviderNameKey = keyof GeneratedI18nStructure
type ProviderConfigPredicate<T extends ProviderConfig = ProviderConfig> = (
  provider: ProviderConfig,
) => provider is T

interface SystemProviderDef {
  id: BuiltInAiProviderId
  modelTier: HostedAiModelTier
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
  id: BuiltInAiProviderId
  name: string
  modelTier: HostedAiModelTier
}

export type ResolvedProviderRef<T extends ProviderConfig = ProviderConfig> =
  | LocalProviderRef<T>
  | SystemProviderRef

const SYSTEM_PROVIDER_DEFS = {
  [BUILT_IN_AI_PROVIDER_ID]: {
    id: BUILT_IN_AI_PROVIDER_ID,
    modelTier: "normal",
    nameKey: BUILT_IN_AI_PROVIDER_NAME_KEY,
    fallbackName: BUILT_IN_AI_PROVIDER_FALLBACK_NAME,
    capabilities: ["pageTranslation", "selectionTranslation", "noteSuggestion", "customAction"],
    logo: () => BUILT_IN_AI_PROVIDER_LOGO,
  },
  [BUILT_IN_AI_ULTRA_PROVIDER_ID]: {
    id: BUILT_IN_AI_ULTRA_PROVIDER_ID,
    modelTier: "ultra",
    nameKey: BUILT_IN_AI_ULTRA_PROVIDER_NAME_KEY,
    fallbackName: BUILT_IN_AI_ULTRA_PROVIDER_FALLBACK_NAME,
    capabilities: ["pageTranslation", "selectionTranslation", "noteSuggestion", "customAction"],
    logo: () => BUILT_IN_AI_PROVIDER_LOGO,
  },
} as const satisfies Record<string, SystemProviderDef>

function getSystemProviderDefs(): SystemProviderDef[] {
  return Object.values(SYSTEM_PROVIDER_DEFS)
}

const LOCAL_PROVIDER_CAPABILITY_PREDICATES = {
  pageTranslation: isTranslateProviderConfig,
  videoSubtitles: isTranslateProviderConfig,
  selectionTranslation: isTranslateProviderConfig,
  inputTranslation: isTranslateProviderConfig,
  noteSuggestion: isLLMProviderConfig,
  customAction: isLLMProviderConfig,
} as const satisfies Record<ProviderCapability, ProviderConfigPredicate>

export type ProviderConfigForCapability<C extends ProviderCapability> =
  (typeof LOCAL_PROVIDER_CAPABILITY_PREDICATES)[C] extends ProviderConfigPredicate<infer T>
    ? T
    : never

export type ProviderRefForCapability<C extends ProviderCapability> = ResolvedProviderRef<
  ProviderConfigForCapability<C>
>

export type CustomActionProviderRef = ProviderRefForCapability<"customAction">
export type SelectionTranslationProviderRef = ProviderRefForCapability<"selectionTranslation">

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
    modelTier: def.modelTier,
  }
}

function getSystemProviderDef(providerId: string): SystemProviderDef | undefined {
  return getSystemProviderDefs().find((def) => def.id === providerId)
}

export function isBuiltInAiProviderId(providerId: string): providerId is BuiltInAiProviderId {
  return BUILT_IN_AI_PROVIDER_IDS.includes(providerId as BuiltInAiProviderId)
}

export function getBuiltInAiProviderName(providerId: BuiltInAiProviderId): string {
  return getSystemProviderName(SYSTEM_PROVIDER_DEFS[providerId])
}

export function getHostedAiModelTier(providerId: BuiltInAiProviderId): HostedAiModelTier {
  return providerId === BUILT_IN_AI_ULTRA_PROVIDER_ID ? "ultra" : "normal"
}

export function isSystemProviderId(providerId: string): boolean {
  return !!getSystemProviderDef(providerId)
}

export function getLocalProviderPredicateForCapability<C extends ProviderCapability>(
  capability: C,
): ProviderConfigPredicate<ProviderConfigForCapability<C>> {
  return LOCAL_PROVIDER_CAPABILITY_PREDICATES[capability] as ProviderConfigPredicate<
    ProviderConfigForCapability<C>
  >
}

export function isLocalProviderConfigCompatibleWithCapability<C extends ProviderCapability>(
  capability: C,
  providerConfig: ProviderConfig,
): providerConfig is ProviderConfigForCapability<C> {
  return getLocalProviderPredicateForCapability(capability)(providerConfig)
}

export function getSystemProviderIdsForCapability(capability: ProviderCapability): string[] {
  return getSystemProviderDefs()
    .filter((def) => def.capabilities.includes(capability))
    .map((def) => def.id)
}

export function doesProviderSupportsCapability(
  capability: ProviderCapability,
  providersConfig: ProvidersConfig,
  providerId: string,
  options: { requireEnable?: boolean } = {},
): boolean {
  const providerConfig = providersConfig.find((provider) => provider.id === providerId)
  if (providerConfig) {
    return (
      (!options.requireEnable || providerConfig.enabled) &&
      isLocalProviderConfigCompatibleWithCapability(capability, providerConfig)
    )
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
    .filter(
      (provider) =>
        (!options.requireEnable || provider.enabled) &&
        isLocalProviderConfigCompatibleWithCapability(capability, provider),
    )
    .map((provider) => provider.id)

  return [...localIds, ...getSystemProviderIdsForCapability(capability)]
}

export function getSelectableProvidersForCapability(
  capability: ProviderCapability,
  providersConfig: ProvidersConfig,
): ProviderSelectorOption[] {
  const systemProviders = getSystemProviderDefs()
    .filter((def) => def.capabilities.includes(capability))
    .map(createSystemProviderSelectorItem)

  const localProviders = providersConfig.filter(
    (provider) =>
      provider.enabled && isLocalProviderConfigCompatibleWithCapability(capability, provider),
  )

  return [...systemProviders, ...localProviders]
}

export function resolveProviderRefForCapability<C extends ProviderCapability>(
  capability: C,
  providersConfig: ProvidersConfig,
  providerId: string,
): ProviderRefForCapability<C> | null {
  const providerConfig = providersConfig.find((provider) => provider.id === providerId)
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
