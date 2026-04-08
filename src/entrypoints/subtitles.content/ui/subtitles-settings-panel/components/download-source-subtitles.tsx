import { i18n } from "#imports"
import { IconDownload, IconLoader2 } from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

export function DownloadSourceSubtitles() {
  const [isDownloading, setIsDownloading] = useState(false)
  const { downloadSourceSubtitles } = useSubtitlesUI()
  const buttonId = "read-frog-download-source-subtitles"

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
      label={i18n.t("subtitles.actions.downloadSource")}
      labelFor={buttonId}
    >
      <>
        <button
          id={buttonId}
          type="button"
          onClick={downloadSubtitles}
          disabled={isDownloading}
          aria-label={i18n.t("subtitles.actions.downloadSource")}
          className="sr-only"
        />
        {isDownloading
          ? <IconLoader2 className="size-3.5 animate-spin text-white/80" />
          : null}
      </>
    </SubtitlesSettingsItem>
  )
}
