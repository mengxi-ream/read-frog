import { toast } from "sonner"
import { env } from "@/env"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"

export function showNotebaseLimitExceededToast() {
  toast.error(i18n.t("action.saveToNotebaseLimitExceeded"), {
    action: {
      label: i18n.t("action.upgrade"),
      onClick: () => {
        void sendMessage("openPage", {
          url: new URL("/pricing", env.WXT_WEBSITE_URL).toString(),
          active: true,
        })
      },
    },
  })
}
