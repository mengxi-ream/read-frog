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
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { ConfigCard } from "../../components/config-card"

export function ClearCacheConfig() {
  const [open, setOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  async function handleClearCache() {
    try {
      setIsClearing(true)
      await sendMessage("clearAllTranslationRelatedCache")
    } catch (error) {
      console.error("Failed to clear cache:", error)
    } finally {
      setIsClearing(false)
      setOpen(false)
    }
  }

  return (
    <ConfigCard
      id="clear-cache"
      title={i18n.t("options.translation.clearCache.title")}
      description={i18n.t("options.translation.clearCache.description")}
    >
      <AlertDialog open={open} onOpenChange={setOpen}>
        <div className="flex w-full justify-end">
          <AlertDialogTrigger render={<Button variant="destructive" disabled={isClearing} />}>
            <IconTrash className="size-4" />
            {isClearing
              ? i18n.t("options.translation.clearCache.clearing")
              : i18n.t("options.translation.clearCache.dialog.trigger")}
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18n.t("options.translation.clearCache.dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t("options.translation.clearCache.dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {i18n.t("options.translation.clearCache.dialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleClearCache}
              disabled={isClearing}
            >
              {isClearing
                ? i18n.t("options.translation.clearCache.clearing")
                : i18n.t("options.translation.clearCache.dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigCard>
  )
}
