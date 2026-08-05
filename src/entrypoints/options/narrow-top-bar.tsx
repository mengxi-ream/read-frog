import { IconSearch } from "@tabler/icons-react"
import { useSetAtom } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { SidebarTrigger } from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"
import { commandPaletteOpenAtom } from "./command-palette/atoms"

/**
 * Below `md` the sidebar becomes an off-canvas sheet that starts closed, taking the whole nav and
 * the command palette's search box with it. This bar is the only visible way back to either — the
 * sidebar's own collapse toggle lives inside the sheet, so without this the sidebar is reachable
 * only through the undiscoverable ⌘/Ctrl+B shortcut.
 */
export function NarrowTopBar() {
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom)

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-0.5 border-b bg-background/85 px-2 backdrop-blur md:hidden">
      <SidebarTrigger aria-label={i18n.t("options.sidebar.toggle")} />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={i18n.t("options.commandPalette.open")}
        onClick={() => setCommandPaletteOpen(true)}
      >
        <IconSearch />
      </Button>
    </header>
  )
}
