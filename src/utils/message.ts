import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
  openOptionsPage: () => void
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
  // anki
  ANKI_REQUEST: (data: { url: string, request: any }) => Promise<{ success: boolean, result?: any, error?: string }>
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
