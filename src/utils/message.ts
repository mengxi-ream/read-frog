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
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
