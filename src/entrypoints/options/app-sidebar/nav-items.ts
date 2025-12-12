import { ApiProvidersPage } from '../pages/api-providers'
import { ConfigPage } from '../pages/config'
import { FloatingButtonAndToolbarPage } from '../pages/floating-button-and-toolbar'
import { GeneralPage } from '../pages/general'
import { StatisticsPage } from '../pages/statistics'
import { TextToSpeechPage } from '../pages/text-to-speech'
import { TranslationPage } from '../pages/translation'

export const ROUTE_CONFIG = [
  { path: '/', component: GeneralPage },
  { path: '/api-providers', component: ApiProvidersPage },
  { path: '/translation', component: TranslationPage },
  { path: '/floating-button-and-toolbar', component: FloatingButtonAndToolbarPage },
  { path: '/tts', component: TextToSpeechPage },
  { path: '/statistics', component: StatisticsPage },
  { path: '/config', component: ConfigPage },
] as const
