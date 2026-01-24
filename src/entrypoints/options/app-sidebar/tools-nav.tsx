import { browser, i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/shadcn/sidebar'

export function ToolsNav() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t('options.sidebar.tools')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href={browser.runtime.getURL('/translation-hub.html')} target="_blank" rel="noopener noreferrer">
                <Icon icon="tabler:language-hiragana" />
                <span>{i18n.t('options.tools.translationHub')}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
