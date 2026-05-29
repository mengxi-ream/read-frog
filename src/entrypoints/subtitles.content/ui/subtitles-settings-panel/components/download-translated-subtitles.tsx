import type { TranslatedExportProgress } from "@/entrypoints/subtitles.content/translated-export"
import { IconDownload, IconLanguage, IconX } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { subtitlesSettingsPanelOpenAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

const SUCCESS_MESSAGE_DURATION_MS = 4000

function isTranslatedExportAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

export function DownloadTranslatedSubtitles() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const clearSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isOpen = useAtomValue(subtitlesSettingsPanelOpenAtom)
  const { downloadTranslatedSubtitles } = useSubtitlesUI()
  const buttonId = "read-frog-download-translated-subtitles"
  const title = i18n.t("subtitles.actions.downloadTranslated")
  const cancelLabel = i18n.t("subtitles.actions.downloadTranslatedCancel")

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
    return () => {
      clearSuccessTimeout()
      abortControllerRef.current?.abort()
    }
  }, [clearSuccessTimeout])

  const handleProgress = useCallback((update: TranslatedExportProgress) => {
    setProgress(update.progress)
    setProgressMessage(
      update.phase === "preparing"
        ? i18n.t("subtitles.actions.downloadTranslatedPreparing")
        : i18n.t("subtitles.actions.downloadTranslatedTranslating"),
    )
  }, [])

  const downloadSubtitles = async () => {
    if (isDownloading) {
      return
    }

    clearSuccessTimeout()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setIsDownloading(true)
    setProgress(0)
    setProgressMessage(i18n.t("subtitles.actions.downloadTranslatedPreparing"))

    try {
      await downloadTranslatedSubtitles({
        signal: abortController.signal,
        onProgress: handleProgress,
      })
      setProgressMessage(i18n.t("subtitles.actions.downloadTranslatedComplete"))
      clearSuccessTimeoutRef.current = setTimeout(() => {
        setProgressMessage(null)
        clearSuccessTimeoutRef.current = null
      }, SUCCESS_MESSAGE_DURATION_MS)
    }
    catch (error) {
      if (isTranslatedExportAbortError(error)) {
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      toast.error(message)
      setProgressMessage(null)
    }
    finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
      setIsDownloading(false)
      setProgress(null)
    }
  }

  const cancelDownload = () => {
    abortControllerRef.current?.abort()
  }

  const handleButtonClick = () => {
    if (isDownloading) {
      cancelDownload()
      return
    }

    void downloadSubtitles()
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
        onClick={handleButtonClick}
        aria-label={isDownloading ? cancelLabel : title}
      >
        {isDownloading
          ? <IconX className="size-3.5" />
          : <IconDownload className="size-3.5" />}
      </Button>
    </SubtitlesSettingsItem>
  )
}
