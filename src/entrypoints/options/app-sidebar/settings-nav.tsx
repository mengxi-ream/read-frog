import { Icon } from "@iconify/react"
import { Link, useLocation } from "react-router"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"

export function SettingsNav() {
  const { pathname } = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.settings")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/api-providers" />}
              isActive={pathname === "/api-providers" || pathname === "/"}
              tooltip={i18n.t("options.apiProviders.title")}
            >
              <Icon icon="tabler:api" />
              <span>{i18n.t("options.apiProviders.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/preference" />}
              isActive={pathname.startsWith("/preference")}
              tooltip={i18n.t("options.preference.title")}
            >
              <Icon icon="tabler:adjustments-horizontal" />
              <span>{i18n.t("options.preference.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/shortcuts" />}
              isActive={pathname === "/shortcuts"}
              tooltip={i18n.t("options.shortcuts.title")}
            >
              <Icon icon="tabler:command" />
              <span>{i18n.t("options.shortcuts.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
