import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { SelectionToolbarFeatureId } from "@/utils/constants/selection"
import { SELECTION_TOOLBAR_FEATURE_IDS } from "@/utils/constants/selection"
import { getSelectionToolbarActions, patchSelectionToolbarAction } from "@/utils/custom-actions"

type SelectionToolbarConfig = Config["selectionToolbar"]

// Everything the selection toolbar can show, in one list: its own translate
// and speak buttons and every action, built-in or custom. An item is pinned
// (shown on the toolbar) when it is enabled; the rest wait in the toolbar's
// "more" menu, which lists them all.
export type SelectionToolbarItem =
  | { kind: "feature"; id: SelectionToolbarFeatureId; enabled: boolean }
  | { kind: "action"; id: string; enabled: boolean; action: SelectionToolbarCustomAction }

function isFeatureId(id: string): id is SelectionToolbarFeatureId {
  return (SELECTION_TOOLBAR_FEATURE_IDS as readonly string[]).includes(id)
}

// Every item in `selectionToolbar.order`. An id the order does not name (an
// action added since) keeps its default place after the ordered ones —
// features, then built-in actions, then custom actions — and an id no item
// has (an action deleted since) is skipped.
export function getSelectionToolbarItems(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarItem[] {
  const byId = new Map<string, SelectionToolbarItem>()
  for (const id of SELECTION_TOOLBAR_FEATURE_IDS) {
    byId.set(id, { kind: "feature", id, enabled: selectionToolbar.features[id].enabled })
  }
  for (const action of getSelectionToolbarActions(selectionToolbar)) {
    byId.set(action.id, {
      kind: "action",
      id: action.id,
      enabled: action.enabled !== false,
      action,
    })
  }

  const ordered: SelectionToolbarItem[] = []
  for (const id of selectionToolbar.order ?? []) {
    const item = byId.get(id)
    if (!item) continue
    ordered.push(item)
    byId.delete(id)
  }
  // A Map iterates in insertion order: what is left is in the default order.
  return [...ordered, ...byId.values()]
}

// The toolbar in a new order of item ids (the menu's, after a drag). The
// custom actions' own list follows it, so it reads in the same order wherever
// it is shown.
export function reorderSelectionToolbarItems(
  selectionToolbar: SelectionToolbarConfig,
  orderedIds: readonly string[],
): SelectionToolbarConfig {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  const rankOf = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER
  return {
    ...selectionToolbar,
    order: [...orderedIds],
    // A stable sort: actions the ids do not name keep their relative order.
    customActions: selectionToolbar.customActions.toSorted((a, b) => rankOf(a.id) - rankOf(b.id)),
  }
}

// The custom actions in a new order of their own (the options page's list):
// they take the places custom actions already hold in the toolbar order, in
// their new order, so both orders agree and nothing else moves.
export function setSelectionToolbarCustomActions(
  selectionToolbar: SelectionToolbarConfig,
  customActions: SelectionToolbarCustomAction[],
): SelectionToolbarConfig {
  const customIds = new Set(customActions.map((action) => action.id))
  const next = { ...selectionToolbar, customActions }
  const inOrder = customActions.map((action) => action.id)
  let slot = 0
  const order = getSelectionToolbarItems(next).map((item) =>
    customIds.has(item.id) ? (inOrder[slot++] ?? item.id) : item.id,
  )
  return { ...next, order }
}

// Pins an item to the toolbar or unpins it: its own enabled switch, the same
// one the settings pages toggle.
export function setSelectionToolbarItemEnabled(
  selectionToolbar: SelectionToolbarConfig,
  id: string,
  enabled: boolean,
): SelectionToolbarConfig {
  if (isFeatureId(id)) {
    return {
      ...selectionToolbar,
      features: {
        ...selectionToolbar.features,
        [id]: { ...selectionToolbar.features[id], enabled },
      },
    }
  }
  return patchSelectionToolbarAction(selectionToolbar, id, { enabled })
}
