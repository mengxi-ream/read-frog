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
  getEnablePageTranslation: (data: { tabId: number }) => boolean | undefined
  setEnablePageTranslation: (data: { tabId: number, enabled: boolean }) => void
  setEnablePageTranslationOnContentScript: (data: { enabled: boolean }) => void
  resetPageTranslationOnNavigation: (data: { url: string }) => void
  // read article
  readArticle: () => void
  popupRequestReadArticle: (data: { tabId: number }) => void
  // user guide
  pinStateChanged: (data: { isPinned: boolean }) => void
  getPinState: () => boolean
  returnPinState: (data: { isPinned: boolean }) => void
  // request
  enqueueTranslateRequest: (data: { text: string, langConfig: Config['language'], providerConfig: ProviderConfig, scheduleAt: number, hash: string }) => Promise<string>
  setTranslateRequestQueueConfig: (data: Partial<RequestQueueConfig>) => void
  setTranslateBatchQueueConfig: (data: Partial<BatchQueueConfig>) => void
  // network proxy
  backgroundFetch: (data: ProxyRequest) => Promise<ProxyResponse>
  // cache management
  clearAllCache: () => Promise<void>
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
