import type { ContextSnapshot, SelectionSnapshot } from "../utils"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type {
  CustomActionProviderRef,
  ProviderRefForCapability,
  SelectionTranslationProviderRef,
} from "@/utils/providers/provider-registry"
import { dequal } from "dequal"
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { selectAtom } from "jotai/utils"
import { configAtom } from "@/utils/atoms/config"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
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
  (get) => get(selectionSessionAtom)?.selectionSnapshot ?? null,
  (_get, set, nextSelection: SelectionSnapshot | null) => {
    if (!nextSelection) {
      set(selectionSessionAtom, null)
      return
    }

    set(
      selectionSessionAtom,
      createSelectionSession(nextSelection, buildContextSnapshot(nextSelection)),
    )
  },
)
export const contextAtom = atom(
  (get) => get(selectionSessionAtom)?.contextSnapshot ?? null,
  (get, set, nextContext: ContextSnapshot | null) => {
    const currentSelection = get(selectionAtom)
    set(selectionSessionAtom, createSelectionSession(currentSelection, nextContext))
  },
)
export const isSelectionToolbarOpenAtom = atom<boolean>(false)

export const selectionContentAtom = atom((get) => get(selectionAtom)?.text ?? null)

export const setSelectionStateAtom = atom(
  null,
  (
    _get,
    set,
    nextState: { selection: SelectionSnapshot | null; context: ContextSnapshot | null },
  ) => {
    set(selectionSessionAtom, createSelectionSession(nextState.selection, nextState.context))
  },
)

export const clearSelectionStateAtom = atom(null, (_get, set) => {
  set(selectionSessionAtom, null)
})

export interface SelectionToolbarTranslateRequestSlice {
  language: Config["language"]
  enableAIContentAware: boolean
  customPromptsConfig: Config["pageTranslation"]["customPromptsConfig"]
  provider: SelectionTranslationProviderRef | null
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
      enableAIContentAware: config.pageTranslation.enableAIContentAware,
      customPromptsConfig: config.pageTranslation.customPromptsConfig,
      provider: resolveProviderRefForCapability(
        "selectionTranslation",
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
      const candidate = findSelectionToolbarAction(config.selectionToolbar, actionId)
      const action = candidate && candidate.enabled !== false ? candidate : null

      return {
        language: config.language,
        action,
        provider: action
          ? resolveProviderRefForCapability(
              "customAction",
              config.providersConfig,
              action.providerId,
            )
          : null,
      }
    },
    dequal,
  )
}

export const selectionToolbarTranslateRequestAtom =
  createSelectionToolbarTranslateRequestSliceAtom()

export type NoteSuggestionProviderRef = ProviderRefForCapability<"noteSuggestion">

/**
 * Deliberately separate from the translate request slice: the translate slice's
 * JSON stringification keys translation re-runs, so folding the suggestion
 * provider in would retranslate the selection whenever only the suggestion
 * provider changes.
 */
export const noteSuggestionProviderAtom = selectAtom(
  configAtom,
  (config): NoteSuggestionProviderRef | null =>
    resolveProviderRefForCapability(
      "noteSuggestion",
      config.providersConfig,
      config.selectionToolbar.noteSuggestion.providerId,
    ),
  dequal,
)

export const selectionToolbarCustomActionRequestAtomFamily = atomFamily((actionId: string) =>
  createSelectionToolbarCustomActionRequestSliceAtom(actionId),
)
