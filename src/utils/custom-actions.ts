import type { Config } from "@/types/config/config"
import type {
  SelectionToolbarBuiltInActionState,
  SelectionToolbarCustomAction,
} from "@/types/config/selection-toolbar"
import type { BuiltInActionId } from "@/utils/constants/custom-action"
import {
  createDefaultDictionaryAction,
  createDefaultImproveWritingAction,
  createDefaultSentenceAnalysisAction,
} from "@/utils/constants/config"
import {
  BUILT_IN_ACTION_IDS,
  BUILT_IN_ACTION_KEYS,
  BUILT_IN_DICTIONARY_ACTION_ID,
  BUILT_IN_IMPROVE_WRITING_ACTION_ID,
  BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID,
  isBuiltInActionId,
} from "@/utils/constants/custom-action"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { getUniqueName } from "@/utils/name"

type SelectionToolbarConfig = Config["selectionToolbar"]

const BUILT_IN_ACTION_DEFINITIONS: Record<BuiltInActionId, () => SelectionToolbarCustomAction> = {
  [BUILT_IN_DICTIONARY_ACTION_ID]: createDefaultDictionaryAction,
  [BUILT_IN_SENTENCE_ANALYSIS_ACTION_ID]: createDefaultSentenceAnalysisAction,
  [BUILT_IN_IMPROVE_WRITING_ACTION_ID]: createDefaultImproveWritingAction,
}

// A built-in action as it reads: its code-owned definition in the current UI
// language, with the persisted enabled/provider/Notebase state merged on.
export function getBuiltInAction(
  selectionToolbar: SelectionToolbarConfig,
  id: BuiltInActionId,
): SelectionToolbarCustomAction {
  const definition = BUILT_IN_ACTION_DEFINITIONS[id]()
  const state = selectionToolbar.builtInActions?.[BUILT_IN_ACTION_KEYS[id]] ?? {
    enabled: definition.enabled !== false,
    providerId: definition.providerId,
  }
  return {
    ...definition,
    enabled: state.enabled,
    providerId: state.providerId,
    ...(state.notebaseConnection ? { notebaseConnection: state.notebaseConnection } : {}),
  }
}

export function getBuiltInDictionaryAction(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarCustomAction {
  return getBuiltInAction(selectionToolbar, BUILT_IN_DICTIONARY_ACTION_ID)
}

export function getBuiltInActions(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarCustomAction[] {
  return BUILT_IN_ACTION_IDS.map((id) => getBuiltInAction(selectionToolbar, id))
}

export function getSelectionToolbarActions(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarCustomAction[] {
  return [...getBuiltInActions(selectionToolbar), ...selectionToolbar.customActions]
}

export function findSelectionToolbarAction(
  selectionToolbar: SelectionToolbarConfig,
  actionId: string,
): SelectionToolbarCustomAction | undefined {
  if (isBuiltInActionId(actionId)) {
    return getBuiltInAction(selectionToolbar, actionId)
  }
  return selectionToolbar.customActions.find((action) => action.id === actionId)
}

export function resolveNoteSuggestionAction(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarCustomAction {
  const actionId = selectionToolbar.noteSuggestion.actionId
  const action = findSelectionToolbarAction(selectionToolbar, actionId)
  if (!action) {
    throw new Error(
      `Note suggestion action "${actionId}" is missing from the validated configuration.`,
    )
  }
  return action
}

function toBuiltInState(action: SelectionToolbarCustomAction): SelectionToolbarBuiltInActionState {
  return {
    enabled: action.enabled !== false,
    providerId: action.providerId,
    notebaseConnection: action.notebaseConnection,
  }
}

export function replaceSelectionToolbarAction(
  selectionToolbar: SelectionToolbarConfig,
  action: SelectionToolbarCustomAction,
): SelectionToolbarConfig {
  if (isBuiltInActionId(action.id)) {
    return {
      ...selectionToolbar,
      builtInActions: {
        ...selectionToolbar.builtInActions,
        [BUILT_IN_ACTION_KEYS[action.id]]: toBuiltInState(action),
      },
    }
  }

  return {
    ...selectionToolbar,
    customActions: selectionToolbar.customActions.map((current) =>
      current.id === action.id ? action : current,
    ),
  }
}

export function patchSelectionToolbarAction(
  selectionToolbar: SelectionToolbarConfig,
  actionId: string,
  patch: Partial<
    Pick<SelectionToolbarCustomAction, "enabled" | "providerId" | "notebaseConnection">
  >,
): SelectionToolbarConfig {
  const action = findSelectionToolbarAction(selectionToolbar, actionId)
  if (!action) {
    return selectionToolbar
  }

  return replaceSelectionToolbarAction(selectionToolbar, { ...action, ...patch })
}

export function duplicateSelectionToolbarAction(
  action: SelectionToolbarCustomAction,
  allActions: SelectionToolbarCustomAction[],
): SelectionToolbarCustomAction {
  return {
    ...structuredClone(action),
    id: getRandomUUID(),
    name: getUniqueName(action.name, new Set(allActions.map((candidate) => candidate.name))),
  }
}
