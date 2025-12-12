import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Link, useLocation } from 'react-router'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/shadcn/sidebar'

export function SettingsNav() {
  const { pathname } = useLocation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t('options.sidebar.settings')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/'}>
              <Link to="/">
                <Icon icon="tabler:adjustments-horizontal" />
                <span>{i18n.t('options.general.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/api-providers'}>
              <Link to="/api-providers">
                <Icon icon="tabler:api" />
                <span>{i18n.t('options.apiProviders.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/translation'}>
              <Link to="/translation">
                <Icon icon="ri:translate" />
                <span>{i18n.t('options.translation.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/floating-button-and-toolbar'}>
              <Link to="/floating-button-and-toolbar">
                <Icon icon="tabler:float-right" />
                <span>{i18n.t('options.floatingButtonAndToolbar.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/tts'}>
              <Link to="/tts">
                <Icon icon="tabler:speakerphone" />
                <span>{i18n.t('options.tts.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/statistics'}>
              <Link to="/statistics">
                <Icon icon="tabler:chart-dots" />
                <span>{i18n.t('options.statistics.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/config'}>
              <Link to="/config">
                <Icon icon="tabler:settings" />
                <span>{i18n.t('options.config.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
