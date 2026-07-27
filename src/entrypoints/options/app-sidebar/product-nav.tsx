import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { buildFeaturebasePortalUrl, type FeaturebasePortalDestination } from "@/utils/featurebase"
import { i18n } from "@/utils/i18n"
import { resolveUiLocale } from "@/utils/i18n/locale-map"

const PRODUCT_LINKS = [
  {
    destination: "roadmap",
    icon: "tabler:route",
    labelKey: "options.product.roadmap",
  },
  {
    destination: "feedback",
    icon: "tabler:message-circle",
    labelKey: "options.product.feedback",
  },
] as const satisfies ReadonlyArray<{
  destination: FeaturebasePortalDestination
  icon: string
  labelKey: "options.product.feedback" | "options.product.roadmap"
}>

export function ProductNav() {
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const locale = resolveUiLocale(uiLanguage)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.product")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {PRODUCT_LINKS.map(({ destination, icon, labelKey }) => {
            const href = buildFeaturebasePortalUrl({ destination, locale })

            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  render={<a href={href} target="_blank" rel="noopener noreferrer" />}
                >
                  <Icon icon={icon} />
                  <span>{i18n.t(labelKey)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
