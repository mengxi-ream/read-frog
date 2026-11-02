import { IconLoader2, IconSubtitles } from "@tabler/icons-react"
import { useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { i18n } from "@/utils/i18n"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubpageMenuEntry } from "./subpage-menu-entry"

export function DownloadSourceSubtitles() {
  const [isDownloading, setIsDownloading] = useState(false)
  const { downloadSourceSubtitles } = useSubtitlesUI()

  const downloadSubtitles = async () => {
    if (isDownloading) {
      return
    }

    setIsDownloading(true)

    try {
      await downloadSourceSubtitles()
    } catch (error) {
      toastManager.add({
        type: "error",
        title: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <SubpageMenuEntry
      icon={
        isDownloading ? (
          <IconLoader2 className="size-3.5 animate-spin" />
        ) : (
          <IconSubtitles className="size-3.5" />
        )
      }
      label={i18n.t("subtitles.actions.downloadSource")}
      onClick={() => void downloadSubtitles()}
      disabled={isDownloading}
      // Busy, not unavailable: the spinner says so, the label stays readable.
      className="disabled:opacity-100"
    />
  )
}
