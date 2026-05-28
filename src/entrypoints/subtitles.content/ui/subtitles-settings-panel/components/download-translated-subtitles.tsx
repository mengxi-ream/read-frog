import { IconDownload, IconLanguage, IconLoader2 } from "@tabler/icons-react"
import { useState } from "react"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

export function DownloadTranslatedSubtitles() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const { downloadTranslatedSubtitles } = useSubtitlesUI()
  const buttonId = "read-frog-download-translated-subtitles"
  const title = i18n.t("subtitles.actions.downloadTranslated")

  const downloadSubtitles = async () => {
    if (isDownloading) {
      return
    }

    setIsDownloading(true)
    setProgress(0)
    const preparingMessage = i18n.t("subtitles.actions.downloadTranslatedPreparing")
    setProgressMessage(preparingMessage)

    try {
      await downloadTranslatedSubtitles((progress) => {
        setProgress(progress)
        const translatingMessage = i18n.t("subtitles.actions.downloadTranslatedTranslating")
        setProgressMessage(translatingMessage)
      })
      setProgressMessage(i18n.t("subtitles.actions.downloadTranslatedComplete"))
    }
    catch (error) {
      setProgressMessage(error instanceof Error ? error.message : String(error))
    }
    finally {
      setIsDownloading(false)
      setProgress(null)
    }
  }

  return (
    <SubtitlesSettingsItem
      icon={<IconLanguage className="size-4" />}
      label={(
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{title}</span>
          {progressMessage && (
            <span className="text-xs leading-4 text-yellow-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]" aria-live="polite">
              {progressMessage}
              {progress !== null && (
                <>
                  {" "}
                  (
                  {progress}
                  %)
                </>
              )}
            </span>
          )}
        </div>
      )}
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
