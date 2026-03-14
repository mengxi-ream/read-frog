import type { ContextSnapshot, SelectionSnapshot } from "../utils"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { dequal } from "dequal"
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { selectAtom } from "jotai/utils"
import { configAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { resolveProviderConfigOrNull } from "@/utils/constants/feature-providers"
import {
  buildContextSnapshot,
  createRangeSnapshot,
  normalizeSelectedText,
  toLiveRange,
} from "../utils"

export const selectionAtom = atom<SelectionSnapshot | null>(null)
export const contextAtom = atom<ContextSnapshot | null>(null)
export const isSelectionToolbarVisibleAtom = atom<boolean>(false)

export const selectionContentAtom = atom(
  get => get(selectionAtom)?.text ?? null,
  (get, set, nextSelectionContent: string | null) => {
    if (nextSelectionContent === null) {
      set(selectionAtom, null)
      set(contextAtom, null)
      return
    }

    const normalizedText = normalizeSelectedText(nextSelectionContent)
    const currentSelection = get(selectionAtom)
    const nextSelection: SelectionSnapshot = currentSelection
      ? { ...currentSelection, text: normalizedText }
      : {
          text: normalizedText,
          ranges: [],
        }

    set(selectionAtom, nextSelection)
    set(contextAtom, nextSelection.ranges.length > 0 ? buildContextSnapshot(nextSelection) : null)
  },
)

export const selectionRangeAtom = atom(
  (get) => {
    const rangeSnapshot = get(selectionAtom)?.ranges[0]
    if (!rangeSnapshot) {
      return null
    }

    try {
      return toLiveRange(rangeSnapshot)
    }
    catch {
      return null
    }
  },
  (get, set, nextRange: Range | null) => {
    if (!nextRange) {
      const currentSelection = get(selectionAtom)
      if (!currentSelection?.text) {
        set(selectionAtom, null)
        set(contextAtom, null)
        return
      }

      set(selectionAtom, { ...currentSelection, ranges: [] })
      set(contextAtom, null)
      return
    }

    const rangeSnapshot = createRangeSnapshot({
      startContainer: nextRange.startContainer,
      startOffset: nextRange.startOffset,
      endContainer: nextRange.endContainer,
      endOffset: nextRange.endOffset,
    })
    const currentSelection = get(selectionAtom)
    const text = currentSelection ? currentSelection.text : normalizeSelectedText(nextRange.toString())

    if (text === "") {
      set(contextAtom, null)
      set(selectionAtom, {
        text,
        ranges: [rangeSnapshot],
      })
      return
    }

    const nextSelection: SelectionSnapshot = {
      text,
      ranges: [rangeSnapshot],
    }

    set(selectionAtom, nextSelection)
    set(contextAtom, buildContextSnapshot(nextSelection))
  },
)

export const setSelectionStateAtom = atom(
  null,
  (_get, set, nextState: { selection: SelectionSnapshot | null, context: ContextSnapshot | null }) => {
    set(selectionAtom, nextState.selection)
    set(contextAtom, nextState.context)
  },
)

export const clearSelectionStateAtom = atom(
  null,
  (_get, set) => {
    set(selectionAtom, null)
    set(contextAtom, null)
  },
)

function createSelectionToolbarFeatureRequestAtom<T>(
  featureKey: "selectionToolbar.translate" | "selectionToolbar.vocabularyInsight", // TODO: make these string in const map
  buildSlice: (config: Config, providerConfig: ProviderConfig | null) => T,
) {
  return selectAtom(
    configAtom,
    config => buildSlice(config, resolveProviderConfigOrNull(config, featureKey)),
    dequal,
  )
}

export interface SelectionToolbarTranslateRequestSlice {
  language: Config["language"]
  enableAIContentAware: boolean
  customPromptsConfig: Config["translate"]["customPromptsConfig"]
  providerConfig: ProviderConfig | null
}

export const selectionToolbarTranslateRequestAtom = createSelectionToolbarFeatureRequestAtom(
  "selectionToolbar.translate",
  (config, providerConfig): SelectionToolbarTranslateRequestSlice => ({
    language: config.language,
    enableAIContentAware: config.translate.enableAIContentAware,
    customPromptsConfig: config.translate.customPromptsConfig,
    providerConfig,
  }),
)

export interface SelectionToolbarVocabularyInsightRequestSlice {
  language: Config["language"]
  providerConfig: ProviderConfig | null
}

export const selectionToolbarVocabularyInsightRequestAtom = createSelectionToolbarFeatureRequestAtom(
  "selectionToolbar.vocabularyInsight",
  (config, providerConfig): SelectionToolbarVocabularyInsightRequestSlice => ({
    language: config.language,
    providerConfig,
  }),
)

export interface SelectionToolbarCustomActionRequestSlice {
  language: Config["language"]
  action: SelectionToolbarCustomAction | null
  providerConfig: ProviderConfig | null
}

export const selectionToolbarCustomActionRequestAtomFamily = atomFamily((actionId: string) =>
  selectAtom(
    configAtom,
    (config): SelectionToolbarCustomActionRequestSlice => {
      const action = config.selectionToolbar.customActions
        .find(candidate => candidate.enabled !== false && candidate.id === actionId) ?? null

      return {
        language: config.language,
        action,
        providerConfig: action
          ? getProviderConfigById(config.providersConfig, action.providerId) ?? null
          : null,
      }
    },
    dequal,
  ),
)
