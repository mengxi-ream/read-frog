import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { SelectionToolbarFeatureId } from "@/utils/constants/selection"
import type { FeatureTag } from "@/utils/features"
import { SELECTION_TOOLBAR_FEATURE_IDS } from "@/utils/constants/selection"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { isShown } from "@/utils/features"
import { normalizeSelectionToolbarLists } from "@/utils/selection-toolbar-order"

type SelectionToolbarConfig = Config["selectionToolbar"]

// Everything the selection toolbar can show, in one list: its own translate
// and speak buttons and every action, built-in or custom. A shown item is in
// the toolbar's "more" menu; one that is not is nowhere. A pinned item also
// has its button on the toolbar itself. Pinning is a state of its own, kept
// while the item is not shown.
export type SelectionToolbarItem =
  | { kind: "feature"; id: SelectionToolbarFeatureId; shown: boolean; pinned: boolean }
  | {
      kind: "action"
      id: string
      shown: boolean
      pinned: boolean
      action: SelectionToolbarCustomAction
    }

// The simple mode features each item belongs to (see isShown). The toolbar's
// own buttons are features themselves; an action has a switch of its own too.
export const SELECTION_TOOLBAR_ITEM_FEATURES = {
  translate: "selectionToolbar.translate",
  speak: "selectionToolbar.speak",
  action: ["selectionToolbar", "customActions"],
} as const satisfies Record<SelectionToolbarFeatureId | "action", FeatureTag>

function isFeatureId(id: string): id is SelectionToolbarFeatureId {
  return (SELECTION_TOOLBAR_FEATURE_IDS as readonly string[]).includes(id)
}

// Every item's id in the toolbar's order. A parsed config has `order` and
// `unpinned` in step already; they are brought in step here too (see
// normalizeSelectionToolbarLists), so a config that did not come through the
// schema reads the same.
function getSelectionToolbarItemIds(selectionToolbar: SelectionToolbarConfig): string[] {
  const actionIds = new Set(getSelectionToolbarActions(selectionToolbar).map((action) => action.id))
  return normalizeSelectionToolbarLists(selectionToolbar).order.filter(
    (id) => isFeatureId(id) || actionIds.has(id),
  )
}

// Every item in the toolbar's order, pinned unless `selectionToolbar.unpinned`
// names it.
export function getSelectionToolbarItems(config: Config): SelectionToolbarItem[] {
  const { selectionToolbar } = config
  const unpinnedIds = new Set(normalizeSelectionToolbarLists(selectionToolbar).unpinned)
  const actions = new Map(
    getSelectionToolbarActions(selectionToolbar).map((action) => [action.id, action]),
  )
  return getSelectionToolbarItemIds(selectionToolbar).flatMap((id): SelectionToolbarItem[] => {
    const pinned = !unpinnedIds.has(id)
    if (isFeatureId(id)) {
      return [
        {
          kind: "feature",
          id,
          shown: isShown(config, SELECTION_TOOLBAR_ITEM_FEATURES[id]),
          pinned,
        },
      ]
    }
    const action = actions.get(id)
    if (!action) return []
    const shown =
      action.enabled !== false && isShown(config, SELECTION_TOOLBAR_ITEM_FEATURES.action)
    return [{ kind: "action", id, shown, pinned, action }]
  })
}

// The "more" menu's last row, which adds a custom action, is there while
// custom actions are.
export function hasAddCustomActionRow(config: Config): boolean {
  return isShown(config, SELECTION_TOOLBAR_ITEM_FEATURES.action)
}

// Whether the toolbar's "more" menu has any rows: a shown item, or the one
// that adds a custom action. With none, the toolbar leaves its button out.
export function hasSelectionToolbarMoreMenu(config: Config): boolean {
  return (
    hasAddCustomActionRow(config) || getSelectionToolbarItems(config).some((item) => item.shown)
  )
}

// `allIds` with the ids of `moved` put in the order `moved` gives them, each
// in a place one of them held: every other id stays where it was.
function reslot(allIds: readonly string[], moved: readonly string[]): string[] {
  const movedIds = new Set(moved)
  let next = 0
  return allIds.map((id) => (movedIds.has(id) ? (moved[next++] ?? id) : id))
}

// The toolbar with some of its items in a new order (the "more" menu's, after
// a drag: it lists only the shown ones), the rest keeping their places. The
// custom actions' own list follows, so it reads in the same order wherever it
// is shown.
export function reorderSelectionToolbarItems(
  selectionToolbar: SelectionToolbarConfig,
  orderedIds: readonly string[],
): SelectionToolbarConfig {
  const order = reslot(getSelectionToolbarItemIds(selectionToolbar), orderedIds)
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
    getSelectionToolbarItemIds(next),
    customActions.map((action) => action.id),
  )
  return { ...next, order }
}

// Puts an item's button on the toolbar, or takes it off (it stays in the
// "more" menu). Its switches are left as they are.
export function setSelectionToolbarItemPinned(
  selectionToolbar: SelectionToolbarConfig,
  id: string,
  pinned: boolean,
): SelectionToolbarConfig {
  const unpinned = (selectionToolbar.unpinned ?? []).filter((other) => other !== id)
  return { ...selectionToolbar, unpinned: pinned ? unpinned : [...unpinned, id] }
}
