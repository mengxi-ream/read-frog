/**
 * Migration script from v104 to v105.
 *
 * Adds `selectionToolbar.order`, the order of every item on the selection
 * toolbar by id, which its "more" menu lets the user drag. It is seeded with
 * the order the toolbar already had: translate, speak, the built-in actions
 * (Dictionary, then Sentence Analysis), then the user's own actions in the
 * order they were listed.
 *
 * Until now a toolbar with every item turned off did not show at all; from
 * v105 it shows its "more" menu, which lists them. A user who had turned
 * every item off gets the toolbar switched off instead, so it stays hidden
 * for them as before.
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

  const customActions: any[] = Array.isArray(selectionToolbar.customActions)
    ? selectionToolbar.customActions
    : []
  const customActionIds: string[] = customActions
    .map((action: any) => (isObject(action) ? action.id : undefined))
    .filter((id: any) => typeof id === "string" && id !== "")

  // A missing or malformed item counts as on: only a toolbar known to have
  // everything off is switched off.
  const everythingOff = [
    selectionToolbar.features?.translate,
    selectionToolbar.features?.speak,
    selectionToolbar.builtInActions?.dictionary,
    selectionToolbar.builtInActions?.sentenceAnalysis,
    ...customActions,
  ].every((item) => isObject(item) && item.enabled === false)

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      ...(everythingOff ? { enabled: false } : {}),
      order: [...new Set([...FEATURE_IDS, ...BUILT_IN_ACTION_IDS, ...customActionIds])],
    },
  }
}
