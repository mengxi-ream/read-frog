import { IconDownload, IconLanguage, IconLoader2 } from "@tabler/icons-react"
import { cva } from "class-variance-authority"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE } from "./download-translated-subtitles.constants"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"
import { useDownloadTranslatedSubtitles } from "./use-download-translated-subtitles"

const downloadTranslatedSubtitlesMessageVariants = cva(
  "text-xs leading-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]",
  {
    variants: {
      tone: {
        [DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Muted]: "text-muted-foreground",
        [DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Success]: "text-emerald-300",
      },
    },
    defaultVariants: {
      tone: DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Muted,
    },
  },
)

export function DownloadTranslatedSubtitles() {
  const { message, messageTone, progress, isRunning, download } = useDownloadTranslatedSubtitles()
  const buttonId = "read-frog-download-translated-subtitles"
  const title = i18n.t("subtitles.actions.downloadTranslated")

  return (
    <SubtitlesSettingsItem
      icon={<IconLanguage className="size-4" />}
      label={(
        <div className="flex min-w-0 flex-col">
          <span className="truncate">{title}</span>
          {message && (
            <span
              className={downloadTranslatedSubtitlesMessageVariants({ tone: messageTone })}
              aria-live="polite"
            >
              {message}
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
        onClick={download}
        disabled={isRunning}
      >
        {isRunning
          ? <IconLoader2 className="size-3.5 animate-spin" />
          : <IconDownload className="size-3.5" />}
      </Button>
    </SubtitlesSettingsItem>
  )
}
