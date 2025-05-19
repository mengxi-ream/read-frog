import { Key, Settings } from 'lucide-react'
import { ApiKeysPage } from '../pages/api-keys'
import { GeneralPage } from '../pages/general'

export const NAV_ITEMS: Record<string, {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType
}> = {
  '': {
    title: 'General',
    url: '/',
    icon: Settings,
    component: GeneralPage,
  },
  'api-keys': {
    title: 'API Keys',
    url: '/api-keys',
    icon: Key,
    component: ApiKeysPage,
  },
}
