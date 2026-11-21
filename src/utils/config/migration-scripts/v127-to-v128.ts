/**
 * Migration script from v127 to v128
 * - Adds `selectionToolbar.placement`, the side of the selection the toolbar
 *   opens on. Existing configs get "followDirection": the side the drag ended
 *   on, which is where the toolbar has always opened.
 *
 * Idempotent: a placement already stored is kept, and a config with nothing to
 * add is returned by identity.
 *
 * IMPORTANT: The values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */

const PLACEMENTS = new Set(["followDirection", "above", "below"])

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function migrate(oldConfig: any): any {
  if (!isPlainObject(oldConfig) || !isPlainObject(oldConfig.selectionToolbar)) {
    return oldConfig
  }
  if (PLACEMENTS.has(oldConfig.selectionToolbar.placement)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...oldConfig.selectionToolbar,
      placement: "followDirection",
    },
  }
}
