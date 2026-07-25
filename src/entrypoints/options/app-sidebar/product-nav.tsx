import { Icon } from "@iconify/react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"

const PRODUCT_LINKS = [
  {
    href: "https://feedback.readfrog.app/roadmap",
    icon: "tabler:route",
    labelKey: "options.product.roadmap",
  },
  {
    href: "https://feedback.readfrog.app/",
    icon: "tabler:message-circle",
    labelKey: "options.product.feedback",
  },
] as const

export function ProductNav() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.product")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {PRODUCT_LINKS.map(({ href, icon, labelKey }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                render={<a href={href} target="_blank" rel="noopener noreferrer" />}
              >
                <Icon icon={icon} />
                <span>{i18n.t(labelKey)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
