import { useAtomValue } from "jotai"
import { subtitlesSidebarOpenAtom } from "../../atoms"
import { SidebarShell } from "./sidebar-shell"

export function SubtitlesSidebar() {
  const isOpen = useAtomValue(subtitlesSidebarOpenAtom)

  if (!isOpen) {
    return null
  }

  return <SidebarShell />
}
