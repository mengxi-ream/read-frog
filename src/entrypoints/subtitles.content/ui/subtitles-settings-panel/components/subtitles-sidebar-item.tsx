import { IconFileTextAi } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { i18n } from "@/utils/i18n"
import { subtitlesSidebarOpenAtom, subtitlesStore } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubpageMenuEntry } from "./subpage-menu-entry"

export function SubtitlesSidebarItem() {
  const { supportsSidebar } = useSubtitlesUI()
  const [isOpen, setOpen] = useAtom(subtitlesSidebarOpenAtom, { store: subtitlesStore })

  // Shorts and embeds mount the settings panel but never mount a sidebar host.
  if (!supportsSidebar) {
    return null
  }

  return (
    <SubpageMenuEntry
      icon={<IconFileTextAi className="size-4" />}
      label={i18n.t("subtitles.sidebar.menu.label")}
      onClick={() => setOpen((open) => !open)}
      pressed={isOpen}
    />
  )
}
