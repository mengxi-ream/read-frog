import { i18n } from "#imports"
import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { sendMessage } from "@/utils/message"
import { ConfigCard } from "../../components/config-card"

export function ClearCacheConfig() {
  const [open, setOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  async function handleClearCache() {
    try {
      setIsClearing(true)
      await sendMessage("clearAllTranslationRelatedCache")
    }
    catch (error) {
      console.error("Failed to clear cache:", error)
    }
    finally {
      setIsClearing(false)
      setOpen(false)
    }
  }

  return (
    <ConfigCard title={i18n.t("options.general.clearCache.title")} description={i18n.t("options.general.clearCache.description")}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <div className="w-full flex justify-end">
          <AlertDialogTrigger render={<Button variant="destructive" disabled={isClearing} />}>
            <IconTrash className="size-4" />
            {isClearing ? i18n.t("options.general.clearCache.clearing") : i18n.t("options.general.clearCache.dialog.trigger")}
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t("options.general.clearCache.dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t("options.general.clearCache.dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t("options.general.clearCache.dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClearCache} disabled={isClearing}>
              {isClearing ? i18n.t("options.general.clearCache.clearing") : i18n.t("options.general.clearCache.dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigCard>
  )
}
