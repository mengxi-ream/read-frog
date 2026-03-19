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

export const selectionAtom = atom<SelectionSnapshot | null>(null)
export const contextAtom = atom<ContextSnapshot | null>(null)
export const isSelectionToolbarVisibleAtom = atom<boolean>(false)

export const selectionContentAtom = atom(get => get(selectionAtom)?.text ?? null)

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
  featureKey: "selectionToolbar.translate", // TODO: make these string in const map
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
