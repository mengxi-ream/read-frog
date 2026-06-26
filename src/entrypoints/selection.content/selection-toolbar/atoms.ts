import type { ContextSnapshot, SelectionSnapshot } from "../utils"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { CustomActionProviderRef, SelectionToolbarTranslateProviderRef } from "@/utils/providers/provider-registry"
import { dequal } from "dequal"
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { selectAtom } from "jotai/utils"
import { configAtom } from "@/utils/atoms/config"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { buildContextSnapshot } from "../utils"

export interface SelectionSession {
  id: number
  createdAt: number
  selectionSnapshot: SelectionSnapshot
  contextSnapshot: ContextSnapshot
}

let nextSelectionSessionId = 0

function createSelectionSession(
  selection: SelectionSnapshot | null,
  context: ContextSnapshot | null,
): SelectionSession | null {
  if (!selection) {
    return null
  }

  const nextContext = context ?? buildContextSnapshot(selection)
  if (!nextContext) {
    return null
  }

  return {
    id: ++nextSelectionSessionId,
    createdAt: Date.now(),
    selectionSnapshot: selection,
    contextSnapshot: nextContext,
  }
}

export const selectionSessionAtom = atom<SelectionSession | null>(null)
export const selectionAtom = atom(
  get => get(selectionSessionAtom)?.selectionSnapshot ?? null,
  (_get, set, nextSelection: SelectionSnapshot | null) => {
    if (!nextSelection) {
      set(selectionSessionAtom, null)
      return
    }

    set(selectionSessionAtom, createSelectionSession(
      nextSelection,
      buildContextSnapshot(nextSelection),
    ))
  },
)
export const contextAtom = atom(
  get => get(selectionSessionAtom)?.contextSnapshot ?? null,
  (get, set, nextContext: ContextSnapshot | null) => {
    const currentSelection = get(selectionAtom)
    set(selectionSessionAtom, createSelectionSession(currentSelection, nextContext))
  },
)
export const isSelectionToolbarVisibleAtom = atom<boolean>(false)

export const selectionContentAtom = atom(get => get(selectionAtom)?.text ?? null)

export const setSelectionStateAtom = atom(
  null,
  (_get, set, nextState: { selection: SelectionSnapshot | null, context: ContextSnapshot | null }) => {
    set(selectionSessionAtom, createSelectionSession(nextState.selection, nextState.context))
  },
)

export const clearSelectionStateAtom = atom(
  null,
  (_get, set) => {
    set(selectionSessionAtom, null)
  },
)

export interface SelectionToolbarTranslateRequestSlice {
  language: Config["language"]
  enableAIContentAware: boolean
  customPromptsConfig: Config["translate"]["customPromptsConfig"]
  provider: SelectionToolbarTranslateProviderRef | null
}

export interface SelectionToolbarCustomActionRequestSlice {
  language: Config["language"]
  action: SelectionToolbarCustomAction | null
  provider: CustomActionProviderRef | null
}

function createSelectionToolbarTranslateRequestSliceAtom() {
  return selectAtom(
    configAtom,
    (config): SelectionToolbarTranslateRequestSlice => ({
      language: config.language,
      enableAIContentAware: config.translate.enableAIContentAware,
      customPromptsConfig: config.translate.customPromptsConfig,
      provider: resolveProviderRefForCapability(
        "selectionToolbar.translate",
        config.providersConfig,
        config.selectionToolbar.features.translate.providerId,
      ),
    }),
    dequal,
  )
}

function createSelectionToolbarCustomActionRequestSliceAtom(actionId: string) {
  return selectAtom(
    configAtom,
    (config): SelectionToolbarCustomActionRequestSlice => {
      const action = config.selectionToolbar.customActions
        .find(candidate => candidate.enabled !== false && candidate.id === actionId) ?? null

      return {
        language: config.language,
        action,
        provider: action
          ? resolveProviderRefForCapability("selectionToolbar.customAction", config.providersConfig, action.providerId)
          : null,
      }
    },
    dequal,
  )
}

export const selectionToolbarTranslateRequestAtom = createSelectionToolbarTranslateRequestSliceAtom()

export const selectionToolbarCustomActionRequestAtomFamily = atomFamily((actionId: string) =>
  createSelectionToolbarCustomActionRequestSliceAtom(actionId),
)
