import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { SelectionToolbarFeatureId } from "@/utils/constants/selection"
import { SELECTION_TOOLBAR_FEATURE_IDS } from "@/utils/constants/selection"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { normalizeSelectionToolbarLists } from "@/utils/selection-toolbar-order"

type SelectionToolbarConfig = Config["selectionToolbar"]

// Everything the selection toolbar can show, in one list: its own translate
// and speak buttons and every action, built-in or custom. An enabled item
// (its own switch, in settings) is in the toolbar's "more" menu; a disabled
// one is nowhere. A pinned item also has its button on the toolbar itself.
// Pinning is a state of its own, kept while the item is disabled.
export type SelectionToolbarItem =
  | { kind: "feature"; id: SelectionToolbarFeatureId; enabled: boolean; pinned: boolean }
  | {
      kind: "action"
      id: string
      enabled: boolean
      pinned: boolean
      action: SelectionToolbarCustomAction
    }

function isFeatureId(id: string): id is SelectionToolbarFeatureId {
  return (SELECTION_TOOLBAR_FEATURE_IDS as readonly string[]).includes(id)
}

// Every item in the toolbar's order, pinned unless `selectionToolbar.unpinned`
// names it. A parsed config has both lists in step already; they are brought
// in step here too (see normalizeSelectionToolbarLists), so a config that did
// not come through the schema reads the same.
export function getSelectionToolbarItems(
  selectionToolbar: SelectionToolbarConfig,
): SelectionToolbarItem[] {
  const { order, unpinned } = normalizeSelectionToolbarLists(selectionToolbar)
  const unpinnedIds = new Set(unpinned)
  const actions = new Map(
    getSelectionToolbarActions(selectionToolbar).map((action) => [action.id, action]),
  )
  return order.flatMap((id): SelectionToolbarItem[] => {
    const pinned = !unpinnedIds.has(id)
    if (isFeatureId(id)) {
      return [{ kind: "feature", id, enabled: selectionToolbar.features[id].enabled, pinned }]
    }
    const action = actions.get(id)
    return action ? [{ kind: "action", id, enabled: action.enabled !== false, pinned, action }] : []
  })
}

// `allIds` with the ids of `moved` put in the order `moved` gives them, each
// in a place one of them held: every other id stays where it was.
function reslot(allIds: readonly string[], moved: readonly string[]): string[] {
  const movedIds = new Set(moved)
  let next = 0
  return allIds.map((id) => (movedIds.has(id) ? (moved[next++] ?? id) : id))
}

// The toolbar with some of its items in a new order (the "more" menu's, after
// a drag: it lists only the enabled ones), the rest keeping their places. The
// custom actions' own list follows, so it reads in the same order wherever it
// is shown.
export function reorderSelectionToolbarItems(
  selectionToolbar: SelectionToolbarConfig,
  orderedIds: readonly string[],
): SelectionToolbarConfig {
  const order = reslot(
    getSelectionToolbarItems(selectionToolbar).map((item) => item.id),
    orderedIds,
  )
  const rank = new Map(order.map((id, index) => [id, index]))
  const rankOf = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER
  return {
    ...selectionToolbar,
    order,
    // A stable sort: actions the order does not name keep their relative order.
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
  const next = { ...selectionToolbar, customActions }
  const order = reslot(
    getSelectionToolbarItems(next).map((item) => item.id),
    customActions.map((action) => action.id),
  )
  return { ...next, order }
}

// Puts an item's button on the toolbar, or takes it off (it stays in the
// "more" menu). Its enabled switch is left as it is.
export function setSelectionToolbarItemPinned(
  selectionToolbar: SelectionToolbarConfig,
  id: string,
  pinned: boolean,
): SelectionToolbarConfig {
  const unpinned = (selectionToolbar.unpinned ?? []).filter((other) => other !== id)
  return { ...selectionToolbar, unpinned: pinned ? unpinned : [...unpinned, id] }
}
