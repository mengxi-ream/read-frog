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
 * Each part is applied on its own, not skipped because another is there: a
 * UI context that loaded ahead of this migration and saved a setting has
 * stored the schema's defaults for both lists (empty) with the config still
 * marked v105. So an empty or missing `order` is seeded, a missing `unpinned`
 * starts empty, and Improve Writing is turned on whatever the lists hold. A
 * config that needs none of it (a second run) is returned by identity; one
 * without a `selectionToolbar` object is left for the schema parse that
 * follows to report.
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
  if (!isObject(selectionToolbar)) {
    return oldConfig
  }

  const next: Record<string, any> = { ...selectionToolbar }
  let changed = false

  if (!Array.isArray(selectionToolbar.order) || selectionToolbar.order.length === 0) {
    const customActionIds: string[] = Array.isArray(selectionToolbar.customActions)
      ? selectionToolbar.customActions
          .map((action: any) => (isObject(action) ? action.id : undefined))
          .filter((id: any) => typeof id === "string" && id !== "")
      : []
    next.order = [...new Set([...FEATURE_IDS, ...BUILT_IN_ACTION_IDS, ...customActionIds])]
    changed = true
  }

  if (!Array.isArray(selectionToolbar.unpinned)) {
    next.unpinned = []
    changed = true
  }

  const builtInActions = selectionToolbar.builtInActions
  const improveWriting = isObject(builtInActions) ? builtInActions.improveWriting : undefined
  if (isObject(improveWriting) && improveWriting.enabled === false) {
    next.builtInActions = {
      ...builtInActions,
      improveWriting: { ...improveWriting, enabled: true },
    }
    next.unpinned = [...new Set([...next.unpinned, IMPROVE_WRITING_ID])]
    changed = true
  }

  return changed ? { ...oldConfig, selectionToolbar: next } : oldConfig
}
