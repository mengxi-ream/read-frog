import type { SubtitlesErrorAction } from "./errors"
import { toastManager } from "@/components/ui/base-ui/toast"
import { sendMessage } from "@/utils/message"

/**
 * The one shape every AI-subtitles denial takes: a sentence saying what
 * happened, plus an optional button the user chooses to press. Deliberately
 * never navigates on its own — stealing focus with a new tab in the middle of
 * a video is what this replaces.
 */
/** Stable, so a double-click refreshes one toast instead of stacking two. */
const WALL_TOAST_ID = "read-frog-subtitles-wall"

export function showSubtitlesErrorToast(title: string, action?: SubtitlesErrorAction): void {
  const toastId = toastManager.add({
    id: WALL_TOAST_ID,
    type: "error",
    title,
    ...(action && {
      actionProps: {
        children: action.label,
        onClick: () => {
          toastManager.close(toastId)
          // Content scripts cannot use chrome.tabs — route through the background.
          void sendMessage("openPage", { url: action.url, active: true })
        },
      },
    }),
  })
}
