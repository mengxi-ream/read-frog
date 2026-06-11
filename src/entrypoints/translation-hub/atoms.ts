import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { TranslateProviderConfig } from "@/types/config/provider"
import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig, getProviderConfigById, getTranslateProvidersConfig } from "@/utils/config/helpers"
import { DEFAULT_TRANSLATION_HUB_PROVIDER_IDS } from "@/utils/constants/translate"

const DEFAULT_TRANSLATION_HUB_PROVIDER_ID = "microsoft-translate-default"

export const sourceLangCodeAtom = atom(
  get => get(configFieldsAtomMap.language).sourceCode,
  (_get, set, value: LangCodeISO6393 | "auto") => set(configFieldsAtomMap.language, { sourceCode: value }),
)

export const targetLangCodeAtom = atom(
  get => get(configFieldsAtomMap.language).targetCode,
  (_get, set, value: LangCodeISO6393) => set(configFieldsAtomMap.language, { targetCode: value }),
)

// === Input Atom ===
export const inputTextAtom = atom("")

// === Detected Source LangCode (from input text) ===
export const detectedSourceLangCodeAtom = atom<LangCodeISO6393 | null>(null)

// === Selected Provider IDs (only store IDs, get config from configFieldsAtomMap) ===
export const selectedProviderIdsAtom = atom(
  (get) => {
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const translateConfig = get(configFieldsAtomMap.translate)
    const translateProviders = getTranslateProvidersConfig(providersConfig)
    const enabledProviders = filterEnabledProvidersConfig(translateProviders) as TranslateProviderConfig[]
    const enabledProviderIds = new Set(enabledProviders.map(provider => provider.id))

    const configuredIds = translateConfig.translationHub?.selectedProviderIds
    if (configuredIds) {
      const enabledConfiguredIds = configuredIds.filter(id => enabledProviderIds.has(id))
      if (configuredIds.length === 0 || enabledConfiguredIds.length > 0) {
        return enabledConfiguredIds
      }
    }

    const enabledDefaultIds = DEFAULT_TRANSLATION_HUB_PROVIDER_IDS.filter(id => enabledProviderIds.has(id))
    if (enabledDefaultIds.length > 0) {
      return enabledDefaultIds
    }

    const defaultMicrosoftProvider = getProviderConfigById(enabledProviders, DEFAULT_TRANSLATION_HUB_PROVIDER_ID)
    if (defaultMicrosoftProvider) {
      return [defaultMicrosoftProvider.id]
    }

    const configuredProvider = getProviderConfigById(enabledProviders, translateConfig.providerId)
    if (configuredProvider) {
      return [configuredProvider.id]
    }

    return enabledProviders[0] ? [enabledProviders[0].id] : []
  },
  async (get, set, ids: string[]) => {
    const translateConfig = get(configFieldsAtomMap.translate)
    await set(configFieldsAtomMap.translate, {
      ...translateConfig,
      translationHub: {
        ...translateConfig.translationHub,
        selectedProviderIds: ids,
      },
    })
  },
)

// === Translation Card UI State ===
export const translationCardExpandedStateAtom = atom<Record<string, boolean>>({})

// === Derived: Selected Provider Configs (read-only) ===
export const selectedProvidersAtom = atom((get) => {
  const ids = get(selectedProviderIdsAtom)
  const providersConfig = get(configFieldsAtomMap.providersConfig)
  return ids
    .map(id => providersConfig.find(p => p.id === id))
    .filter((p): p is TranslateProviderConfig => p !== undefined)
})

// === Write-Only Action Atom (only for operations that touch multiple atoms) ===
export const exchangeLangCodesAtom = atom(null, async (get, set) => {
  const source = get(sourceLangCodeAtom)
  if (source === "auto")
    return // Cannot exchange when source is auto
  const target = get(targetLangCodeAtom)
  await set(configFieldsAtomMap.language, {
    sourceCode: target,
    targetCode: source,
  })
})

// === Translation Request (Command Pattern) ===
// When translate button is clicked, store snapshot here. Cards watch timestamp to trigger.
export interface TranslateRequest {
  inputText: string
  sourceLanguage: LangCodeISO6393 | "auto"
  targetLanguage: LangCodeISO6393
  timestamp: number
}

export const translateRequestAtom = atom<TranslateRequest | null>(null)
