import { IconSearch } from "@tabler/icons-react"
import { useSetAtom } from "jotai"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/base-ui/input-group"
import { Kbd } from "@/components/ui/base-ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/base-ui/sidebar"
import { UserAccountMenuSidebar } from "@/components/user-account-menu"
import { i18n } from "@/utils/i18n"
import { getCommandPaletteShortcutHint } from "@/utils/os"
import { commandPaletteOpenAtom } from "../command-palette/atoms"
import { SettingsNav } from "./settings-nav"
import { ToolsNav } from "./tools-nav"
import { WhatsNewFooter } from "./whats-new-footer"

export function AppSidebar() {
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom)
  const commandPaletteShortcutHint = getCommandPaletteShortcutHint()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[state=expanded]:px-5 group-data-[state=expanded]:pt-4 transition-all">
        <UserAccountMenuSidebar />
        <InputGroup
          onClick={() => setCommandPaletteOpen(true)}
          className="bg-background"
        >
          <InputGroupInput
            readOnly
            placeholder={i18n.t("options.commandPalette.placeholder")}
            className="cursor-pointer"
          />
          <InputGroupAddon>
            <IconSearch className="size-4 text-muted-foreground group-data-[state=collapsed]:-mx-px" />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className="group-data-[state=collapsed]:hidden"
          >
            <Kbd>{commandPaletteShortcutHint}</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </SidebarHeader>
      <SidebarContent className="group-data-[state=expanded]:px-2 transition-all">
        <SettingsNav />
        <ToolsNav />
      </SidebarContent>
      <SidebarFooter className="group-data-[state=expanded]:px-2 transition-all">
        <WhatsNewFooter />
      </SidebarFooter>
    </Sidebar>
  )
}
