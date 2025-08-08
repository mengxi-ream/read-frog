import type { Config } from '@/types/config/config'
import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
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
  enqueueRequest: (data: { type: string, params: Record<string, any>, scheduleAt: number, hash: string }) => Promise<any>
  setTranslateRequestQueueConfig: (data: { rate?: number, capacity?: number }) => void
  // network proxy
  backgroundFetch: (data: {
    url: string
    method?: string
    headers?: [string, string][]
    body?: string
    credentials?: 'omit' | 'same-origin' | 'include'
  }) => Promise<{
    status: number
    statusText: string
    headers: [string, string][]
    body: string
  }>
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
