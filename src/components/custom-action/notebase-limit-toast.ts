import { toastManager } from "@/components/ui/base-ui/toast"
import { pricingUrl } from "@/utils/error-action"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"

export function showNotebaseLimitExceededToast() {
  const toastId = toastManager.add({
    type: "error",
    title: i18n.t("action.saveToNotebaseLimitExceeded"),
    actionProps: {
      children: i18n.t("action.upgrade"),
      onClick: () => {
        toastManager.close(toastId)
        void sendMessage("openPage", {
          url: pricingUrl("extension_notebase_limit"),
          active: true,
        })
      },
    },
  })
}
