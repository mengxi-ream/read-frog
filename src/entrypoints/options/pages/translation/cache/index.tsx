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
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

/** Translations Read Frog keeps so a page it has seen before costs nothing to open again. */
export function CacheSection() {
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
    <ConfigSection id="cache" title={i18n.t("options.translation.cache.title")}>
      <ConfigItem
        id="clear-cache"
        title={i18n.t("options.translation.cache.clearCache.title")}
        description={i18n.t("options.translation.cache.clearCache.description")}
      >
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={<Button variant="destructive" size="sm" disabled={isClearing} />}
          >
            <IconTrash className="size-4" />
            {isClearing
              ? i18n.t("options.translation.cache.clearCache.clearing")
              : i18n.t("options.translation.cache.clearCache.dialog.trigger")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {i18n.t("options.translation.cache.clearCache.dialog.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("options.translation.cache.clearCache.dialog.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {i18n.t("options.translation.cache.clearCache.dialog.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleClearCache}
                disabled={isClearing}
              >
                {isClearing
                  ? i18n.t("options.translation.cache.clearCache.clearing")
                  : i18n.t("options.translation.cache.clearCache.dialog.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ConfigItem>
    </ConfigSection>
  )
}
