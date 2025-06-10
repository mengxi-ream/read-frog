import { Link } from 'react-router'
import readFrogLogo from '@/assets/icon/read-frog.png'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { version } from '../../../../../../package.json'
import { NAV_ITEMS } from './nav-items'

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[state=expanded]:px-5 group-data-[state=expanded]:pt-4 transition-all">
        <a href="https://readfrog.app" className="flex items-center gap-2">
          <img src={readFrogLogo} alt="Logo" className="h-8 w-8 shrink-0" />
          <span className="text-md font-bold overflow-hidden truncate">{i18n.t('name')}</span>
          <span className="text-xs text-muted-foreground overflow-hidden truncate">
            {`v${version}`}
          </span>
        </a>
      </SidebarHeader>
      <SidebarContent className="group-data-[state=expanded]:px-2 transition-all">
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {Object.entries(NAV_ITEMS).map(([key, item]) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{i18n.t(`options.${item.title}.title`)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
