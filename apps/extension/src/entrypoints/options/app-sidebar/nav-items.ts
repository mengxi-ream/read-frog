import { WEBSITE_URL } from '@/utils/constants/url'
import { ApiProvidersPage } from '../pages/api-providers'
import { ConfigPage } from '../pages/config'
import { FloatingButtonPage } from '../pages/floating-button'
import { GeneralPage } from '../pages/general'
import { TextToSpeechPage } from '../pages/text-to-speech'
import { TranslationPage } from '../pages/translation'

type NavItemTitle = 'general' | 'apiProviders' | 'translation' | 'floatingButton' | 'tts' | 'config' | 'whatsNew' | 'survey'

interface ComponentNavItem {
  type: 'component'
  title: NavItemTitle
  action?: boolean
  url: string
  icon: string
  component: React.ComponentType
}

interface ExternalNavItem {
  type: 'external'
  title: NavItemTitle
  action?: boolean
  externalUrl: string
  icon: string
}

export type NavItem = ComponentNavItem | ExternalNavItem

export const SETTING_NAV_ITEMS = {
  '': {
    type: 'component',
    title: 'general',
    url: '/',
    icon: 'tabler:adjustments-horizontal',
    component: GeneralPage,
  },
  'api-providers': {
    type: 'component',
    title: 'apiProviders',
    url: '/api-providers',
    icon: 'tabler:api',
    component: ApiProvidersPage,
  },
  'translation': {
    type: 'component',
    title: 'translation',
    url: '/translation',
    icon: 'ri:translate',
    component: TranslationPage,
  },
  'floating-button': {
    type: 'component',
    title: 'floatingButton',
    url: '/floating-button',
    icon: 'tabler:float-right',
    component: FloatingButtonPage,
  },
  'text-to-speech': {
    type: 'component',
    title: 'tts',
    url: '/tts',
    icon: 'tabler:speakerphone',
    component: TextToSpeechPage,
  },
  'config': {
    type: 'component',
    title: 'config',
    url: '/config',
    icon: 'tabler:settings',
    component: ConfigPage,
  },
} as const satisfies Record<string, NavItem>

export const PRODUCT_NAV_ITEMS = {
  'whats-new': {
    type: 'external',
    title: 'whatsNew',
    action: true,
    externalUrl: `${WEBSITE_URL}/blog?latest-indicator=true`,
    icon: 'tabler:sparkles',
  },
  'survey': {
    type: 'external',
    title: 'survey',
    action: true,
    externalUrl: 'https://tally.so/r/m6aRVO',
    icon: 'tabler:message-question',
  },
} as const satisfies Record<string, NavItem>
