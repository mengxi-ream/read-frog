import { browser, i18n } from "#imports"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"

export function SplitTranslatorButton({ className }: { className?: string }) {
  const handleOpenSplitTranslator = () => {
    void sendMessage("toggleSidePanel", {
      source: "extension-user-action",
      windowId: browser.windows.WINDOW_ID_CURRENT,
    })
      .then((result) => {
        if (result?.ok !== false) {
          return
        }

        if (result.reason === "requires-extension-user-action") {
          toast.info(i18n.t("popup.splitTranslator.firefoxSidebarHint"))
          return
        }

        toast.error(i18n.t("popup.splitTranslator.openFailed"))
      })
      .catch(() => {
        toast.error(i18n.t("popup.splitTranslator.openFailed"))
      })
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleOpenSplitTranslator}
      className={cn("block truncate", className)}
    >
      {i18n.t("popup.splitTranslator.open")}
    </Button>
  )
}
