import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Link, useLocation } from 'react-router'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/shadcn/sidebar'

const OVERLAY_TOOLS_PATHS = ['/floating-button', '/selection-toolbar', '/context-menu'] as const

export function SettingsNav() {
  const { pathname } = useLocation()
  const isOverlayToolsActive = OVERLAY_TOOLS_PATHS.includes(pathname)

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
            <SidebarMenuButton asChild isActive={pathname === '/site-control'}>
              <Link to="/site-control">
                <Icon icon="tabler:world-check" />
                <span>{i18n.t('options.siteControl.title')}</span>
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
            <SidebarMenuButton asChild isActive={pathname === '/video-subtitles'}>
              <Link to="/video-subtitles">
                <Icon icon="tabler:subtitles" />
                <span>{i18n.t('options.videoSubtitles.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/input-translation'}>
              <Link to="/input-translation">
                <Icon icon="tabler:keyboard" />
                <span>{i18n.t('options.overlayTools.inputTranslation.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible defaultOpen={isOverlayToolsActive} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton isActive={isOverlayToolsActive}>
                  <Icon icon="tabler:layers-intersect" />
                  <span>{i18n.t('options.overlayTools.title')}</span>
                  <Icon
                    icon="tabler:chevron-right"
                    className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/floating-button'}>
                      <Link to="/floating-button">
                        <span>{i18n.t('options.overlayTools.floatingButton.title')}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/selection-toolbar'}>
                      <Link to="/selection-toolbar">
                        <span>{i18n.t('options.overlayTools.selectionToolbar.title')}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/context-menu'}>
                      <Link to="/context-menu">
                        <span>{i18n.t('options.overlayTools.contextMenu.title')}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

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
