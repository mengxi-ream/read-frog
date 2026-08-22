import { IconFileTextAi } from "@tabler/icons-react"
import { useAtom } from "jotai"
import { i18n } from "@/utils/i18n"
import { subtitlesSidebarOpenAtom, subtitlesStore } from "../../../atoms"
import { SubpageMenuEntry } from "./subpage-menu-entry"

export function SubtitlesSidebarItem() {
  const [isOpen, setOpen] = useAtom(subtitlesSidebarOpenAtom, { store: subtitlesStore })

  return (
    <SubpageMenuEntry
      icon={<IconFileTextAi className="size-4" />}
      label={i18n.t("subtitles.sidebar.menu.label")}
      onClick={() => setOpen((open) => !open)}
      pressed={isOpen}
    />
  )
}
