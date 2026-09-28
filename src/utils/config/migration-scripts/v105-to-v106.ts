/**
 * Migration script from v105 to v106.
 *
 * Adds two lists for the selection toolbar's "more" menu:
 *
 * - `selectionToolbar.order`: the order of every toolbar item by id, which
 *   the menu lets the user drag. Seeded with the order the toolbar already
 *   had: translate, speak, the built-in actions (Dictionary, Sentence
 *   Analysis, Improve Writing), then the user's own actions in the order they
 *   were listed.
 * - `selectionToolbar.unpinned`: the items kept off the toolbar itself, in the
 *   menu only. Every item the toolbar showed stays on it.
 *
 * The built-in Improve Writing (v105) came turned off, since without the menu
 * turning it on meant a new toolbar button for everyone. With the menu it is
 * turned on but kept off the toolbar: it waits in the menu. One the user has
 * turned on already is on their toolbar, and stays there.
 *
 * A config that already has an `order` array (a second run) is returned by
 * identity. One without a `selectionToolbar` object is left for the schema
 * parse that follows to report.
 *
 * IMPORTANT: This is a frozen snapshot. All ids are hardcoded inline; it
 * imports nothing from the evolving application code.
 */

const FEATURE_IDS = ["translate", "speak"]
const BUILT_IN_ACTION_IDS = [
  "default-dictionary",
  "default-sentence-analysis",
  "default-improve-writing",
]
const IMPROVE_WRITING_ID = "default-improve-writing"

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

  const builtInActions = selectionToolbar.builtInActions
  const improveWriting = isObject(builtInActions) ? builtInActions.improveWriting : undefined
  const turnOnImproveWriting = isObject(improveWriting) && improveWriting.enabled === false

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      ...(turnOnImproveWriting
        ? {
            builtInActions: {
              ...builtInActions,
              improveWriting: { ...improveWriting, enabled: true },
            },
          }
        : {}),
      order: [...new Set([...FEATURE_IDS, ...BUILT_IN_ACTION_IDS, ...customActionIds])],
      unpinned: turnOnImproveWriting ? [IMPROVE_WRITING_ID] : [],
    },
  }
}
