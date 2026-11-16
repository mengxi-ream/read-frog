import type { NoteOriginInput } from "@read-frog/definitions"
import type { ContextSnapshot, SelectionSnapshot } from "../utils"
import type { SelectionToolbarCustomActionRequestSlice } from "@/components/custom-action/use-custom-action-execution"
import type { Config } from "@/types/config/config"
import type {
  ProviderRefForCapability,
  SelectionTranslationProviderRef,
} from "@/utils/providers/provider-registry"
import { dequal } from "dequal"
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { selectAtom } from "jotai/utils"
import { configAtom } from "@/utils/atoms/config"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { createLogger } from "@/utils/logging/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { getWebPageNoteOrigin } from "@/utils/note-origin"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { buildContextSnapshot } from "../utils"

const log = createLogger("selection-toolbar/atoms")

export interface SelectionSession {
  id: number
  createdAt: number
  selectionSnapshot: SelectionSnapshot
  contextSnapshot: ContextSnapshot
  /**
   * Where the selection was made, recorded with each note saved from it. Read
   * when the selection is made, since a save can finish after the page is gone.
   * Null when the note gets no origin.
   */
  noteOrigin: NoteOriginInput | null
}

let nextSelectionSessionId = 0

/**
 * `noteOrigin` defaults to the page this frame shows; a selection relayed from
 * elsewhere (the ebook reader) passes its own, or null.
 */
export function createSelectionSession(
  selection: SelectionSnapshot | null,
  context: ContextSnapshot | null,
  noteOrigin?: NoteOriginInput | null,
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
    noteOrigin: noteOrigin === undefined ? getWebPageNoteOrigin() : noteOrigin,
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
    const current = get(selectionSessionAtom)
    set(
      selectionSessionAtom,
      createSelectionSession(current?.selectionSnapshot ?? null, nextContext, current?.noteOrigin),
    )
  },
)
export const isSelectionToolbarOpenAtom = atom<boolean>(false)

/**
 * Hidden from its close menu until the page reloads. It changes no setting:
 * the background keeps it for the tab, so the toolbar in every frame of the
 * page follows it, and a reload or a new tab brings the toolbar back. Like a
 * site opt-out, it hides only the bar; shortcuts keep working.
 */
export const isSelectionToolbarHiddenUntilReloadAtom = atom(false)
isSelectionToolbarHiddenUntilReloadAtom.onMount = (setHidden) => {
  // A frame whose toolbar starts after another frame hid it, such as an iframe
  // that loads or navigates later.
  void (async () => {
    if (await sendMessage("isSelectionToolbarHiddenUntilReload", undefined)) setHidden(true)
  })().catch((error) => log.debug("Failed to read the toolbar's hidden state", { error }))
  return onMessage("selectionToolbarHiddenUntilReload", () => setHidden(true))
}

/** Hides the toolbar in this frame at once, then in the tab's other frames. */
export const hideSelectionToolbarUntilReloadAtom = atom(null, (_get, set) => {
  set(isSelectionToolbarHiddenUntilReloadAtom, true)
  void (async () => {
    await sendMessage("hideSelectionToolbarUntilReload", undefined)
  })().catch((error) => log.debug("Failed to hide the toolbar in other frames", { error }))
})

export const selectionContentAtom = atom((get) => get(selectionAtom)?.text ?? null)

export const setSelectionStateAtom = atom(
  null,
  (
    _get,
    set,
    nextState: {
      selection: SelectionSnapshot | null
      context: ContextSnapshot | null
      /** Omitted for a selection in this frame's page. */
      noteOrigin?: NoteOriginInput | null
    },
  ) => {
    set(
      selectionSessionAtom,
      createSelectionSession(nextState.selection, nextState.context, nextState.noteOrigin),
    )
  },
)

export const clearSelectionStateAtom = atom(null, (_get, set) => {
  set(selectionSessionAtom, null)
})

export interface SelectionToolbarTranslateRequestSlice {
  language: Config["language"]
  enableAIContentAware: boolean
  /** Read from config here so the request path never has to touch storage. */
  glossaryEnabled: boolean
  customPromptsConfig: Config["pageTranslation"]["customPromptsConfig"]
  provider: SelectionTranslationProviderRef | null
}

function createSelectionToolbarTranslateRequestSliceAtom() {
  return selectAtom(
    configAtom,
    (config): SelectionToolbarTranslateRequestSlice => ({
      language: config.language,
      enableAIContentAware: config.pageTranslation.enableAIContentAware,
      glossaryEnabled: config.glossary.enabled,
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
