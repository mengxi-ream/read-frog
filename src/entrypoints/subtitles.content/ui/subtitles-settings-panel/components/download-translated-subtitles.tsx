import { IconDownload, IconLanguage, IconLoader2 } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { subtitlesSettingsPanelOpenAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

const SUCCESS_MESSAGE_DURATION_MS = 4000

export function DownloadTranslatedSubtitles() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const clearSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOpen = useAtomValue(subtitlesSettingsPanelOpenAtom)
  const { downloadTranslatedSubtitles } = useSubtitlesUI()
  const buttonId = "read-frog-download-translated-subtitles"
  const title = i18n.t("subtitles.actions.downloadTranslated")

  const clearSuccessTimeout = useCallback(() => {
    if (clearSuccessTimeoutRef.current !== null) {
      clearTimeout(clearSuccessTimeoutRef.current)
      clearSuccessTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen && !isDownloading) {
      clearSuccessTimeout()
      // Activity hides the panel without unmounting, so close events must clear retained local status.
      // eslint-disable-next-line react/set-state-in-effect
      setProgressMessage(null)
      // eslint-disable-next-line react/set-state-in-effect
      setProgress(null)
    }
  }, [clearSuccessTimeout, isOpen, isDownloading])

  useEffect(() => {
    return clearSuccessTimeout
  }, [clearSuccessTimeout])

  const downloadSubtitles = async () => {
    if (isDownloading) {
      return
    }

    clearSuccessTimeout()
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
      clearSuccessTimeoutRef.current = setTimeout(() => {
        setProgressMessage(null)
        clearSuccessTimeoutRef.current = null
      }, SUCCESS_MESSAGE_DURATION_MS)
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      setProgressMessage(null)
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
