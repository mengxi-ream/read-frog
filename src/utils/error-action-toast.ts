import type { ErrorAction } from "./error-action"
import { toastManager } from "@/components/ui/base-ui/toast"
import { sendMessage } from "@/utils/message"

/**
 * The button a toast shows for an error's call to action, such as "Log in". It
 * closes the toast and opens the page through the background, since content
 * scripts cannot use `chrome.tabs`. It never navigates on its own.
 */
export function getErrorActionToastProps(action: ErrorAction, toastId: string) {
  return {
    children: action.label,
    onClick: () => {
      toastManager.close(toastId)
      void sendMessage("openPage", { url: action.url, active: true })
    },
  }
}
