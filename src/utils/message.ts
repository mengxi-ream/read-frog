import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
  openOptionsPage: () => void
  getIsPageTranslated: (data: { tabId: number }) => boolean | undefined
  uploadIsPageTranslated: (data: { isPageTranslated: boolean }) => void
  updateIsPageTranslated: (data: {
    tabId: number
    isPageTranslated: boolean
  }) => void
  setIsPageTranslatedOnSideContent: (data: { isPageTranslated: boolean }) => void
  readArticle: () => void
  popupRequestReadArticle: (data: { tabId: number }) => void
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
