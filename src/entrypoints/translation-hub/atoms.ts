import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig, getTranslateProvidersConfig } from "@/utils/config/helpers"
import {
  getProviderIdsForCapability,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"

// === Language preferences (null follows the extension language setting) ===

export const sourceLangCodeAtom = atom(
  (get) => {
    return (
      get(configFieldsAtomMap.translationHub).sourceCode ??
      get(configFieldsAtomMap.language).sourceCode
    )
  },
  (_get, set, value: LangCodeISO6393 | "auto") =>
    set(configFieldsAtomMap.translationHub, { sourceCode: value }),
)

export const targetLangCodeAtom = atom(
  (get) => {
    return (
      get(configFieldsAtomMap.translationHub).targetCode ??
      get(configFieldsAtomMap.language).targetCode
    )
  },
  (_get, set, value: LangCodeISO6393) =>
    set(configFieldsAtomMap.translationHub, { targetCode: value }),
)

// === Input Atom ===
export const inputTextAtom = atom("")

// === Detected Source LangCode (from input text) ===
export const detectedSourceLangCodeAtom = atom<LangCodeISO6393 | null>(null)

/** Named after the empty input, which detects as nothing but still has to name the auto row. */
const FALLBACK_DETECTED_LANG_CODE: LangCodeISO6393 = "eng"

/**
 * The language the auto row stands for: what the source selector reads while `auto` is
 * selected, and so also what `auto` hands over when the two languages swap.
 */
export const detectedLangCodeAtom = atom(
  (get) => get(detectedSourceLangCodeAtom) ?? FALLBACK_DETECTED_LANG_CODE,
)

// === Selected Provider IDs (null follows enabled local translation providers) ===
export function getAvailableHubProviderIds(config: Pick<Config, "providersConfig">): string[] {
  return getProviderIdsForCapability("pageTranslation", config.providersConfig, {
    requireEnable: true,
  })
}

export const selectedProviderIdsAtom = atom(
  (get) => {
    const ids = get(configFieldsAtomMap.translationHub).selectedProviderIds
    const providersConfig = get(configFieldsAtomMap.providersConfig)
    if (ids === null) {
      return filterEnabledProvidersConfig(getTranslateProvidersConfig(providersConfig)).map(
        (provider) => provider.id,
      )
    }
    const available = new Set(getAvailableHubProviderIds({ providersConfig }))
    return [...new Set(ids)].filter((id) => available.has(id))
  },
  (_get, set, ids: string[]) =>
    set(configFieldsAtomMap.translationHub, { selectedProviderIds: ids }),
)

// === Translation Card UI State ===
export const translationCardExpandedStateAtom = atom<Record<string, boolean>>({})

// === Derived: Selected Provider Refs (read-only) ===
export const selectedProvidersAtom = atom((get) => {
  const ids = get(selectedProviderIdsAtom)
  const providersConfig = get(configFieldsAtomMap.providersConfig)
  return ids
    .map((id) => resolveProviderRefForCapability("pageTranslation", providersConfig, id))
    .filter((provider) => provider !== null)
})

// === Write-Only Action Atom (only for operations that touch multiple atoms) ===
export const exchangeLangCodesAtom = atom(null, (get, set) => {
  const source = get(sourceLangCodeAtom)
  const target = get(targetLangCodeAtom)
  // `auto` is no language to hand to the target side, so it hands over the one the source
  // selector was reading — the detected one — and the swap stays what the eye saw.
  void set(configFieldsAtomMap.translationHub, {
    sourceCode: target,
    targetCode: source === "auto" ? get(detectedLangCodeAtom) : source,
  })
})

// === Translation Request (Command Pattern) ===
// When translate button is clicked, store snapshot here. Cards watch timestamp to trigger.
export interface TranslateRequest {
  inputText: string
  sourceLanguage: LangCodeISO6393 | "auto"
  targetLanguage: LangCodeISO6393
  timestamp: number
  promptConfig: Config["pageTranslation"]["customPromptsConfig"]
}

export const translateRequestAtom = atom<TranslateRequest | null>(null)
