import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { TranslateProviderConfig } from "@/types/config/provider"
import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig, getTranslateProvidersConfig } from "@/utils/config/helpers"

// === LangCode Atoms (persist through the shared language config) ===
export const sourceLangCodeAtom = atom(
  (get) => get(configFieldsAtomMap.language).sourceCode,
  (_get, set, value: LangCodeISO6393 | "auto") =>
    set(configFieldsAtomMap.language, { sourceCode: value }),
)

export const targetLangCodeAtom = atom(
  (get) => get(configFieldsAtomMap.language).targetCode,
  (_get, set, value: LangCodeISO6393) => set(configFieldsAtomMap.language, { targetCode: value }),
)

// === Input Atom ===
export const inputTextAtom = atom("")

// === Detected Source LangCode (from input text) ===
export const detectedSourceLangCodeAtom = atom<LangCodeISO6393 | null>(null)

// === Selected Provider IDs (persist IDs and derive live provider config) ===
export const selectedProviderIdsAtom = atom(
  (get) => {
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const translateProviders = getTranslateProvidersConfig(providersConfig)
    const enabledIds = filterEnabledProvidersConfig(translateProviders).map((p) => p.id)
    const selectedIds = get(configFieldsAtomMap.translationHub).selectedProviderIds

    if (selectedIds === null) return enabledIds

    const enabledIdSet = new Set(enabledIds)
    return selectedIds.filter((id) => enabledIdSet.has(id))
  },
  (_get, set, ids: string[]) =>
    set(configFieldsAtomMap.translationHub, { selectedProviderIds: ids }),
)

// === Translation Card UI State ===
export const translationCardExpandedStateAtom = atom<Record<string, boolean>>({})

// === Derived: Selected Provider Configs (read-only) ===
export const selectedProvidersAtom = atom((get) => {
  const ids = get(selectedProviderIdsAtom)
  const providersConfig = get(configFieldsAtomMap.providersConfig)
  return ids
    .map((id) => providersConfig.find((p) => p.id === id))
    .filter((p): p is TranslateProviderConfig => p !== undefined)
})

// === Write-Only Action Atom (only for operations that touch multiple atoms) ===
export const exchangeLangCodesAtom = atom(null, async (get, set) => {
  const language = get(configFieldsAtomMap.language)
  if (language.sourceCode === "auto") return // Cannot exchange when source is auto

  await set(configFieldsAtomMap.language, {
    sourceCode: language.targetCode,
    targetCode: language.sourceCode,
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
