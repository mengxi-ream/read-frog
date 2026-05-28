import { IconDownload, IconLanguage, IconLoader2 } from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

export function DownloadTranslatedSubtitles() {
  const [isDownloading, setIsDownloading] = useState(false)
  const { downloadTranslatedSubtitles } = useSubtitlesUI()
  const buttonId = "read-frog-download-translated-subtitles"
  const title = i18n.t("subtitles.actions.downloadTranslated")

  const downloadSubtitles = async () => {
    if (isDownloading) {
      return
    }

    setIsDownloading(true)
    const toastId = toast.loading(`${title} (0%)`)

    try {
      await downloadTranslatedSubtitles((progress) => {
        toast.loading(`${title} (${progress}%)`, { id: toastId })
      })
      toast.success(i18n.t("subtitles.actions.downloadTranslatedComplete"), { id: toastId })
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : String(error), { id: toastId })
    }
    finally {
      setIsDownloading(false)
    }
  }

  return (
    <SubtitlesSettingsItem
      icon={<IconLanguage className="size-4" />}
      label={title}
      labelFor={buttonId}
    >
      <Button
        id={buttonId}
        type="button"
        variant="ghost-secondary"
        size="icon-sm"
        onClick={downloadSubtitles}
        disabled={isDownloading}
      >
        {isDownloading
          ? <IconLoader2 className="size-3.5 animate-spin" />
          : <IconDownload className="size-3.5" />}
      </Button>
    </SubtitlesSettingsItem>
  )
}
