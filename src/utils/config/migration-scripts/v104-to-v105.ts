/**
 * Migration script from v104 to v105.
 *
 * Adds two lists for the selection toolbar's "more" menu:
 *
 * - `selectionToolbar.order`: the order of every toolbar item by id, which
 *   the menu lets the user drag. Seeded with the order the toolbar already
 *   had: translate, speak, the built-in actions (Dictionary, then Sentence
 *   Analysis), then the user's own actions in the order they were listed.
 * - `selectionToolbar.unpinned`: the items kept off the toolbar itself.
 *   Empty: every item the toolbar showed stays on it.
 *
 * A config that already has an `order` array (a second run) is returned by
 * identity. One without a `selectionToolbar` object is left for the schema
 * parse that follows to report.
 *
 * IMPORTANT: This is a frozen snapshot. All ids are hardcoded inline; it
 * imports nothing from the evolving application code.
 */

const FEATURE_IDS = ["translate", "speak"]
const BUILT_IN_ACTION_IDS = ["default-dictionary", "default-sentence-analysis"]

function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isObject(oldConfig)) {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  if (!isObject(selectionToolbar) || Array.isArray(selectionToolbar.order)) {
    return oldConfig
  }

  const customActionIds: string[] = Array.isArray(selectionToolbar.customActions)
    ? selectionToolbar.customActions
        .map((action: any) => (isObject(action) ? action.id : undefined))
        .filter((id: any) => typeof id === "string" && id !== "")
    : []

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      order: [...new Set([...FEATURE_IDS, ...BUILT_IN_ACTION_IDS, ...customActionIds])],
      unpinned: [],
    },
  }
}
