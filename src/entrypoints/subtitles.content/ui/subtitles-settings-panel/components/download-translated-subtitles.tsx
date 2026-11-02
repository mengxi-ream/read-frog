import { IconLanguage, IconLoader2 } from "@tabler/icons-react"
import { cva } from "class-variance-authority"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE } from "./download-translated-subtitles.constants"
import { SubpageMenuEntry } from "./subpage-menu-entry"
import { useDownloadTranslatedSubtitles } from "./use-download-translated-subtitles"

const downloadTranslatedSubtitlesMessageVariants = cva(
  "text-xs leading-4 whitespace-normal drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]",
  {
    variants: {
      tone: {
        [DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Muted]: "text-muted-foreground",
        [DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Success]: "text-success",
      },
    },
    defaultVariants: {
      tone: DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Muted,
    },
  },
)

export function DownloadTranslatedSubtitles() {
  const { message, messageTone, progress, isRunning, download } = useDownloadTranslatedSubtitles()
  const title = i18n.t("subtitles.actions.downloadTranslated")

  return (
    <SubpageMenuEntry
      icon={
        isRunning ? (
          <IconLoader2 className="size-3.5 animate-spin" />
        ) : (
          <IconLanguage className="size-3.5" />
        )
      }
      label={
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{title}</span>
          {message && (
            <span
              className={cn(
                downloadTranslatedSubtitlesMessageVariants({ tone: messageTone }),
                isRunning && "shimmer",
              )}
              aria-live="polite"
            >
              {message}
              {progress !== null && (
                <>
                  {" "}
                  ({progress}
                  %)
                </>
              )}
            </span>
          )}
        </span>
      }
      onClick={download}
      disabled={isRunning}
      // Busy, not unavailable: the spinner and progress line say so, and stay readable.
      className="disabled:opacity-100"
    />
  )
}
