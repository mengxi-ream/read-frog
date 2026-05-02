import { browser, i18n } from "#imports"
import { toast } from "sonner"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"

export function SplitTranslatorButton({ className }: { className?: string }) {
  const windowIdRef = useRef(browser.windows.WINDOW_ID_CURRENT)

  useEffect(() => {
    void browser.windows.getCurrent().then((w) => {
      if (typeof w.id === "number") {
        windowIdRef.current = w.id
      }
    })
  }, [])

  const handleOpenSplitTranslator = () => {
    void Promise.resolve(sendMessage("toggleSidePanel", {
      source: "extension-user-action",
      windowId: windowIdRef.current,
    }))
      .then((result) => {
        if (result?.ok === false) {
          if (result.reason === "requires-extension-user-action") {
            toast.info(i18n.t("popup.splitTranslator.firefoxSidebarHint"))
            return
          }

          toast.error(i18n.t("popup.splitTranslator.openFailed"))
        }
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
