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

/** Segmentation results Read Frog keeps so a video it has cut before costs nothing to replay. */
export function CacheSection() {
  const [open, setOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  async function handleClearCache() {
    try {
      setIsClearing(true)
      await sendMessage("clearAiSegmentationCache")
    } catch (error) {
      console.error("Failed to clear AI segmentation cache:", error)
    } finally {
      setIsClearing(false)
      setOpen(false)
    }
  }

  return (
    <ConfigSection id="subtitles-cache" title={i18n.t("options.videoSubtitles.cache.title")}>
      <ConfigItem
        id="clear-ai-segmentation-cache"
        title={i18n.t("options.videoSubtitles.cache.clearCache.title")}
        description={i18n.t("options.videoSubtitles.cache.clearCache.description")}
      >
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={<Button variant="destructive" size="sm" disabled={isClearing} />}
          >
            <IconTrash className="size-4" />
            {isClearing
              ? i18n.t("options.videoSubtitles.cache.clearCache.clearing")
              : i18n.t("options.videoSubtitles.cache.clearCache.dialog.trigger")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {i18n.t("options.videoSubtitles.cache.clearCache.dialog.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {i18n.t("options.videoSubtitles.cache.clearCache.dialog.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {i18n.t("options.videoSubtitles.cache.clearCache.dialog.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleClearCache}
                disabled={isClearing}
              >
                {isClearing
                  ? i18n.t("options.videoSubtitles.cache.clearCache.clearing")
                  : i18n.t("options.videoSubtitles.cache.clearCache.dialog.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ConfigItem>
    </ConfigSection>
  )
}
