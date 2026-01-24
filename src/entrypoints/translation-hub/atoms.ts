import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { TranslateProviderConfig } from '@/types/config/provider'
import { atom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getTranslateProvidersConfig } from '@/utils/config/helpers'

// === Language Atoms (derive from config, local override) ===
const sourceLanguageOverrideAtom = atom<LangCodeISO6393 | null>(null)
const targetLanguageOverrideAtom = atom<LangCodeISO6393 | null>(null)

export const sourceLanguageAtom = atom(
  (get) => {
    const override = get(sourceLanguageOverrideAtom)
    if (override !== null)
      return override
    const { sourceCode } = get(configFieldsAtomMap.language)
    return sourceCode === 'auto' ? 'eng' : sourceCode
  },
  (_get, set, value: LangCodeISO6393) => set(sourceLanguageOverrideAtom, value),
)

export const targetLanguageAtom = atom(
  (get) => {
    const override = get(targetLanguageOverrideAtom)
    if (override !== null)
      return override
    return get(configFieldsAtomMap.language).targetCode
  },
  (_get, set, value: LangCodeISO6393) => set(targetLanguageOverrideAtom, value),
)

// === Input Atom ===
export const inputTextAtom = atom('')

// === Selected Provider IDs (only store IDs, get config from configFieldsAtomMap) ===
const selectedProviderIdsOverrideAtom = atom<string[] | null>(null)

export const selectedProviderIdsAtom = atom(
  (get) => {
    const override = get(selectedProviderIdsOverrideAtom)
    if (override !== null)
      return override
    // Default: all enabled translate providers' IDs
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const translateProviders = getTranslateProvidersConfig(providersConfig)
    return filterEnabledProvidersConfig(translateProviders).map(p => p.id)
  },
  (_get, set, ids: string[]) => set(selectedProviderIdsOverrideAtom, ids),
)

// === Derived: Selected Provider Configs (read-only) ===
export const selectedProvidersAtom = atom((get) => {
  const ids = get(selectedProviderIdsAtom)
  const providersConfig = get(configFieldsAtomMap.providersConfig)
  return ids
    .map(id => providersConfig.find(p => p.id === id))
    .filter((p): p is TranslateProviderConfig => p !== undefined)
})

// === Write-Only Action Atom (only for operations that touch multiple atoms) ===
export const exchangeLanguagesAtom = atom(null, (get, set) => {
  const source = get(sourceLanguageAtom)
  const target = get(targetLanguageAtom)
  set(sourceLanguageAtom, target)
  set(targetLanguageAtom, source)
})

// === Translation Request (Command Pattern) ===
// When translate button is clicked, store snapshot here. Cards watch timestamp to trigger.
export interface TranslateRequest {
  inputText: string
  sourceLanguage: LangCodeISO6393
  targetLanguage: LangCodeISO6393
  timestamp: number
}

export const translateRequestAtom = atom<TranslateRequest | null>(null)
