/**
 * Migration script from v115 to v116
 * - Adds `selectionToolbar.annotation`, the toolbar's word-annotation slot
 *   (underline the selection, write its meaning between the lines): on, with
 *   its default key, Alt+Shift+E.
 *
 * Idempotent: a config that already has the field is returned by identity.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  const selectionToolbar = oldConfig?.selectionToolbar
  if (
    !selectionToolbar ||
    typeof selectionToolbar !== "object" ||
    Array.isArray(selectionToolbar) ||
    (selectionToolbar.annotation !== null && typeof selectionToolbar.annotation === "object")
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      annotation: { enabled: true, shortcut: "Alt+Shift+E" },
    },
  }
}
