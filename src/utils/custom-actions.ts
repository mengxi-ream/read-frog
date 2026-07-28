import type { Config } from "@/types/config/config"
import type {
  SelectionToolbarBuiltInActionState,
  SelectionToolbarCustomAction,
} from "@/types/config/selection-toolbar"
import { createDefaultDictionaryAction } from "@/utils/constants/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { getUniqueName } from "@/utils/name"

type SelectionToolbarConfig = Config["selectionToolbar"]

export function getBuiltInDictionaryAction(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarCustomAction {
  const definition = createDefaultDictionaryAction()
  if (!definition) {
    throw new Error("Built-in Dictionary action definition is unavailable")
  }

  const state = selectionToolbar.builtInActions?.dictionary ?? {
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

export function getSelectionToolbarActions(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarCustomAction[] {
  return [getBuiltInDictionaryAction(selectionToolbar), ...selectionToolbar.customActions]
}

export function findSelectionToolbarAction(
  selectionToolbar: SelectionToolbarConfig,
  actionId: string,
): SelectionToolbarCustomAction | undefined {
  if (actionId === BUILT_IN_DICTIONARY_ACTION_ID) {
    return getBuiltInDictionaryAction(selectionToolbar)
  }
  return selectionToolbar.customActions.find((action) => action.id === actionId)
}

export function resolveSaveSuggestionAction(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarCustomAction {
  const actionId = selectionToolbar.saveSuggestion.actionId
  const action = findSelectionToolbarAction(selectionToolbar, actionId)
  if (!action) {
    throw new Error(
      `Save Suggestion action "${actionId}" is missing from the validated configuration.`,
    )
  }
  return action
}

function toBuiltInDictionaryState(
  action: SelectionToolbarCustomAction,
): SelectionToolbarBuiltInActionState {
  return {
    enabled: action.enabled !== false,
    providerId: action.providerId,
    ...(action.notebaseConnection ? { notebaseConnection: action.notebaseConnection } : {}),
  }
}

export function replaceSelectionToolbarAction(
  selectionToolbar: SelectionToolbarConfig,
  action: SelectionToolbarCustomAction,
): SelectionToolbarConfig {
  if (action.id === BUILT_IN_DICTIONARY_ACTION_ID) {
    return {
      ...selectionToolbar,
      builtInActions: {
        ...selectionToolbar.builtInActions,
        dictionary: toBuiltInDictionaryState(action),
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
