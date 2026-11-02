import { DownloadSourceSubtitles } from "../components/download-source-subtitles"
import { DownloadTranslatedSubtitles } from "../components/download-translated-subtitles"

export function DownloadView() {
  return (
    <div className="p-1">
      <div className="space-y-0.5">
        <DownloadSourceSubtitles />
        <DownloadTranslatedSubtitles />
      </div>
    </div>
  )
}
