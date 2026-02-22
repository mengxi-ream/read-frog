import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Link, useLocation } from 'react-router'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/base-ui/collapsible'
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
} from '@/components/ui/base-ui/sidebar'

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
            <SidebarMenuButton render={<Link to="/" />} isActive={pathname === '/'}>
              <Icon icon="tabler:adjustments-horizontal" />
              <span>{i18n.t('options.general.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/api-providers" />} isActive={pathname === '/api-providers'}>
              <Icon icon="tabler:api" />
              <span>{i18n.t('options.apiProviders.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/translation" />} isActive={pathname === '/translation'}>
              <Icon icon="ri:translate" />
              <span>{i18n.t('options.translation.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/video-subtitles" />} isActive={pathname === '/video-subtitles'}>
              <Icon icon="tabler:subtitles" />
              <span>{i18n.t('options.videoSubtitles.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/input-translation" />} isActive={pathname === '/input-translation'}>
              <Icon icon="tabler:keyboard" />
              <span>{i18n.t('options.overlayTools.inputTranslation.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible defaultOpen={isOverlayToolsActive} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger render={<SidebarMenuButton isActive={isOverlayToolsActive} />}>
                <Icon icon="tabler:layers-intersect" />
                <span>{i18n.t('options.overlayTools.title')}</span>
                <Icon
                  icon="tabler:chevron-right"
                  className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/floating-button" />} isActive={pathname === '/floating-button'}>
                      <span>{i18n.t('options.overlayTools.floatingButton.title')}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/selection-toolbar" />} isActive={pathname === '/selection-toolbar'}>
                      <span>{i18n.t('options.overlayTools.selectionToolbar.title')}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link to="/context-menu" />} isActive={pathname === '/context-menu'}>
                      <span>{i18n.t('options.overlayTools.contextMenu.title')}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/tts" />} isActive={pathname === '/tts'}>
              <Icon icon="tabler:speakerphone" />
              <span>{i18n.t('options.tts.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/statistics" />} isActive={pathname === '/statistics'}>
              <Icon icon="tabler:chart-dots" />
              <span>{i18n.t('options.statistics.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/config" />} isActive={pathname === '/config'}>
              <Icon icon="tabler:settings" />
              <span>{i18n.t('options.config.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
