import type { SubtitlesErrorAction } from "./errors"
import { anchoredToastManager, toastManager } from "@/components/ui/base-ui/toast"
import { sendMessage } from "@/utils/message"

/** Stable, so a double-click refreshes one toast instead of stacking two. */
const WALL_TOAST_ID = "read-frog-subtitles-wall"
/**
 * Longer than the shared defaults (5s docked, 3s anchored): this toast is the
 * only place the refusal is explained, and it asks the reader to aim at a
 * button rather than just acknowledge a line of text.
 */
const WALL_TOAST_TIMEOUT_MS = 10_000

let aiRequestAnchor: HTMLElement | null = null

/**
 * The "Request AI subtitles" control, registered by the panel item that owns
 * it. Only refusals of that request anchor to it — every other subtitles toast
 * stays docked in the page corner, because nothing on screen would explain
 * what a toast pinned to this button had to do with them.
 */
export function setAiSubtitlesToastAnchor(element: HTMLElement | null): void {
  aiRequestAnchor = element
}

function isAnchorVisible(element: HTMLElement | null): boolean {
  if (!element?.isConnected) {
    return false
  }
  const { width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0
}

function usableAnchor(): HTMLElement | null {
  return isAnchorVisible(aiRequestAnchor) ? aiRequestAnchor : null
}

function show(title: string, action: SubtitlesErrorAction | undefined, anchor: HTMLElement | null) {
  const manager = anchor ? anchoredToastManager : toastManager
  const toastId = manager.add({
    id: WALL_TOAST_ID,
    type: "error",
    title,
    timeout: WALL_TOAST_TIMEOUT_MS,
    // base-ui's positioner reads side/align off this; its defaults (top,
    // center) are what "above the button" means.
    ...(anchor && { positionerProps: { anchor, sideOffset: 8 } }),
    ...(action && {
      actionProps: {
        children: action.label,
        onClick: () => {
          manager.close(toastId)
          // Content scripts cannot use chrome.tabs — route through the background.
          void sendMessage("openPage", { url: action.url, active: true })
        },
      },
    }),
  })
}

/**
 * The one shape every subtitles denial takes: a sentence saying what happened,
 * plus an optional button the user chooses to press. Deliberately never
 * navigates on its own — stealing focus with a new tab in the middle of a
 * video is what this replaces.
 */
export function showSubtitlesErrorToast(title: string, action?: SubtitlesErrorAction): void {
  show(title, action, null)
}

/**
 * The same toast, raised over the control the reader just pressed. Only the AI
 * subtitles request uses it: the docked corner is a long way from the player
 * and easy to miss when you are looking at the panel you just clicked in.
 *
 * Falls back to the docked corner when that control is off screen — a refusal
 * arriving after the panel closed still has to be seen.
 */
export function showAiSubtitlesWallToast(title: string, action?: SubtitlesErrorAction): void {
  show(title, action, usableAnchor())
}

/**
 * Same again for callers that own their anchor rather than registering it. The
 * registered anchor is a single slot owned by the AI subtitles button, so a
 * second control sharing it would just overwrite the first.
 */
export function showAnchoredSubtitlesToast(
  title: string,
  anchor: HTMLElement | null,
  action?: SubtitlesErrorAction,
): void {
  show(title, action, isAnchorVisible(anchor) ? anchor : null)
}
