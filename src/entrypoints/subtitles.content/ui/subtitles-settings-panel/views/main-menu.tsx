import type { ViewId } from "."
import { VISIBLE_SUBPAGES } from "."
import { DownloadSourceSubtitles } from "../components/download-source-subtitles"
import { SubpageMenuEntry } from "../components/subpage-menu-entry"
import { SubtitlesToggle } from "../components/subtitles-toggle"

export function MainMenu({ onNavigate }: { onNavigate: (id: ViewId) => void }) {
  return (
    <div className="px-2 py-2.5">
      <div className="space-y-1.5">
        <SubtitlesToggle />
        <DownloadSourceSubtitles />

        {VISIBLE_SUBPAGES.map(page => (
          <SubpageMenuEntry
            key={page.id}
            icon={page.icon}
            label={page.title}
            onClick={() => onNavigate(page.id)}
          />
        ))}
      </div>
    </div>
  )
}
