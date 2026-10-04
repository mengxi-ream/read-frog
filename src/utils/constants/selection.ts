export const MARGIN = 25

export const MIN_SELECTION_OVERLAY_OPACITY = 1
export const MAX_SELECTION_OVERLAY_OPACITY = 100
export const DEFAULT_SELECTION_OVERLAY_OPACITY = 100

/** Fired when an external source (e.g. the readfrog.app ebook reader) relays a selection. */
export const EXTERNAL_SELECTION_OPEN_EVENT = "read-frog:external-selection-open"
/** Fired when an external source dismisses its relayed selection. */
export const EXTERNAL_SELECTION_CLEAR_EVENT = "read-frog:external-selection-clear"

/** The lazy iframe trigger replays the gesture after React installs its listeners. */
export const DEFERRED_SELECTION_OPEN_EVENT = "read-frog:deferred-selection-open"
export const SELECTION_TOOLBAR_READY_EVENT = "read-frog:selection-toolbar-ready"

export interface DeferredSelectionOpenDetail {
  text: string
  x: number
  y: number
}

declare global {
  interface Window {
    __READ_FROG_SELECTION_TOOLBAR_READY__?: boolean
  }
}

// The toolbar's own buttons, by the ids they have in `selectionToolbar.order`
// beside the actions' ids.
export const SELECTION_TOOLBAR_FEATURE_IDS = ["translate", "speak"] as const
export type SelectionToolbarFeatureId = (typeof SELECTION_TOOLBAR_FEATURE_IDS)[number]
