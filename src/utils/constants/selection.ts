export const MARGIN = 25

export const MIN_SELECTION_OVERLAY_OPACITY = 1
export const MAX_SELECTION_OVERLAY_OPACITY = 100
export const DEFAULT_SELECTION_OVERLAY_OPACITY = 100

/** Fired when an external source (e.g. the readfrog.app ebook reader) relays a selection. */
export const EXTERNAL_SELECTION_OPEN_EVENT = "read-frog:external-selection-open"
/** Fired when an external source dismisses its relayed selection. */
export const EXTERNAL_SELECTION_CLEAR_EVENT = "read-frog:external-selection-clear"

// The toolbar's own buttons, by the ids they have in `selectionToolbar.order`
// beside the actions' ids.
export const SELECTION_TOOLBAR_FEATURE_IDS = ["translate", "speak"] as const
export type SelectionToolbarFeatureId = (typeof SELECTION_TOOLBAR_FEATURE_IDS)[number]
