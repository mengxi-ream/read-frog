import { i18n } from '#imports'
import readFrogLogo from '@/assets/icons/read-frog.png'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from '@/components/shadcn/sidebar'
import { version } from '../../../../package.json'
import { ProductNav } from './product-nav'
import { SettingsNav } from './settings-nav'
import { ToolsNav } from './tools-nav'

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
        <SettingsNav />
        <ToolsNav />
        <ProductNav />
      </SidebarContent>
    </Sidebar>
  )
}
