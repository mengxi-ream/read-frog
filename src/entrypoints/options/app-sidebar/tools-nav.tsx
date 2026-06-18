import { i18n } from "#imports"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/base-ui/sidebar"

export function ToolsNav() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.tools")}</SidebarGroupLabel>
      <SidebarGroupContent />
    </SidebarGroup>
  )
}
