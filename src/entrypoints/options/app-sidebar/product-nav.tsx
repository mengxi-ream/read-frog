import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { Link, useLocation } from "react-router"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { buildFeaturebasePortalUrl } from "@/utils/featurebase"
import { i18n } from "@/utils/i18n"
import { resolveUiLocale } from "@/utils/i18n/locale-map"

export function ProductNav() {
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const locale = resolveUiLocale(uiLanguage)
  const { pathname } = useLocation()

  const roadmapHref = buildFeaturebasePortalUrl({ destination: "roadmap", locale })

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.product")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<a href={roadmapHref} target="_blank" rel="noopener noreferrer" />}
              tooltip={i18n.t("options.product.roadmap")}
            >
              <Icon icon="tabler:route" />
              <span>{i18n.t("options.product.roadmap")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Feedback used to leave for the portal; it is a page now, and the portal is one
              of the ways to reach us listed on it. */}
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/contact-us" />}
              isActive={pathname === "/contact-us"}
              tooltip={i18n.t("options.contactUs.title")}
            >
              <Icon icon="tabler:message-circle" />
              <span>{i18n.t("options.contactUs.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
