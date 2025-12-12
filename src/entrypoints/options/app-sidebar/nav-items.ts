import { ApiProvidersPage } from '../pages/api-providers'
import { ConfigPage } from '../pages/config'
import { ContextMenuPage } from '../pages/context-menu'
import { FloatingButtonPage } from '../pages/floating-button'
import { GeneralPage } from '../pages/general'
import { SelectionToolbarPage } from '../pages/selection-toolbar'
import { StatisticsPage } from '../pages/statistics'
import { TextToSpeechPage } from '../pages/text-to-speech'
import { TranslationPage } from '../pages/translation'

export const ROUTE_CONFIG = [
  { path: '/', component: GeneralPage },
  { path: '/api-providers', component: ApiProvidersPage },
  { path: '/translation', component: TranslationPage },
  { path: '/floating-button', component: FloatingButtonPage },
  { path: '/selection-toolbar', component: SelectionToolbarPage },
  { path: '/context-menu', component: ContextMenuPage },
  { path: '/tts', component: TextToSpeechPage },
  { path: '/statistics', component: StatisticsPage },
  { path: '/config', component: ConfigPage },
] as const
