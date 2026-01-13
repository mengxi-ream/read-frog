import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { Config } from '@/types/config/config'
import type { ProviderConfig } from '@/types/config/provider'
import type { BatchQueueConfig, RequestQueueConfig } from '@/types/config/translate'
import type { ProxyRequest, ProxyResponse } from '@/types/proxy-fetch'
import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
  // navigation
  openPage: (data: { url: string, active?: boolean }) => void
  openOptionsPage: () => void
  // config
  getInitialConfig: () => Config | null
  // translation state
  getEnablePageTranslationByTabId: (data: { tabId: number }) => boolean | undefined
  getEnablePageTranslationFromContentScript: () => Promise<boolean>
  tryToSetEnablePageTranslationByTabId: (data: { tabId: number, enabled: boolean }) => void
  tryToSetEnablePageTranslationOnContentScript: (data: { enabled: boolean }) => void
  setAndNotifyPageTranslationStateChangedByManager: (data: { enabled: boolean }) => void
  notifyTranslationStateChanged: (data: { enabled: boolean }) => void
  // for auto start page translation
  checkAndAskAutoPageTranslation: (data: { url: string, detectedCodeOrUnd: LangCodeISO6393 | 'und' }) => void
  // ask host to start page translation
  askManagerToTogglePageTranslation: (data: { enabled: boolean }) => void
  // read article
  readArticle: () => void
  popupRequestReadArticle: (data: { tabId: number }) => void
  // user guide
  pinStateChanged: (data: { isPinned: boolean }) => void
  getPinState: () => boolean
  returnPinState: (data: { isPinned: boolean }) => void
  // selection helpers
  analyzeSelection: (data: { providerId: string, systemPrompt: string, userMessage: string, temperature?: number }) => Promise<string>
  // request
  enqueueTranslateRequest: (data: { text: string, langConfig: Config['language'], providerConfig: ProviderConfig, scheduleAt: number, hash: string, articleTitle?: string, articleTextContent?: string }) => Promise<string>
  enqueueSubtitlesTranslateRequest: (data: { text: string, langConfig: Config['language'], providerConfig: ProviderConfig, scheduleAt: number, hash: string, videoTitle?: string, subtitlesContext?: string }) => Promise<string>
  setTranslateRequestQueueConfig: (data: Partial<RequestQueueConfig>) => void
  setTranslateBatchQueueConfig: (data: Partial<BatchQueueConfig>) => void
  // network proxy
  backgroundFetch: (data: ProxyRequest) => Promise<ProxyResponse>
  // cache management
  clearAllTranslationRelatedCache: () => Promise<void>
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
