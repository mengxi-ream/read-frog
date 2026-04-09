import { i18n } from "#imports"
import { IconDownload, IconLoader2 } from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

export function DownloadSourceSubtitles() {
  const [isDownloading, setIsDownloading] = useState(false)
  const { downloadSourceSubtitles } = useSubtitlesUI()
  const buttonId = "read-frog-download-source-subtitles"
  const title = i18n.t("subtitles.actions.downloadSource")

  const downloadSubtitles = async () => {
    if (isDownloading) {
      return
    }

    setIsDownloading(true)

    try {
      await downloadSourceSubtitles()
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
    finally {
      setIsDownloading(false)
    }
  }

  return (
    <SubtitlesSettingsItem
      icon={<IconDownload className="size-4" />}
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
        className="border border-white/10 bg-white/6 text-white/88 hover:bg-white/10 focus-visible:border-white/18 focus-visible:ring-white/18"
      >
        {isDownloading
          ? <IconLoader2 className="size-3.5 animate-spin text-white/80" />
          : <IconDownload className="size-3.5 text-white/72" />}
      </Button>
    </SubtitlesSettingsItem>
  )
}
