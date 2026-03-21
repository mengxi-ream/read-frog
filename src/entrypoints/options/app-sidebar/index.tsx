import { i18n } from "#imports"
import { IconSearch } from "@tabler/icons-react"
import { useSetAtom } from "jotai"
import readFrogLogo from "@/assets/icons/read-frog.png"
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
import { getCommandPaletteShortcutHint } from "@/utils/os"
import { version } from "../../../../package.json"
import { commandPaletteOpenAtom } from "../command-palette/atoms"
import { ProductNav } from "./product-nav"
import { SettingsNav } from "./settings-nav"
import { ToolsNav } from "./tools-nav"
import { WhatsNewFooter } from "./whats-new-footer"

export function AppSidebar() {
  const setCommandPaletteOpen = useSetAtom(commandPaletteOpenAtom)
  const commandPaletteShortcutHint = getCommandPaletteShortcutHint()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[state=expanded]:px-5 group-data-[state=expanded]:pt-4 transition-all">
        <a href="https://readfrog.app" className="flex items-center gap-2">
          <img src={readFrogLogo} alt="Logo" className="h-8 w-8 shrink-0" />
          <span className="text-md font-bold overflow-hidden truncate">{i18n.t("name")}</span>
          <span className="text-xs text-muted-foreground overflow-hidden truncate">
            {`v${version}`}
          </span>
        </a>
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
        <ProductNav />
      </SidebarContent>
      <SidebarFooter className="group-data-[state=expanded]:px-2 transition-all">
        <WhatsNewFooter />
      </SidebarFooter>
    </Sidebar>
  )
}
