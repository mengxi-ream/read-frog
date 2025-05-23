import type { LangCodeISO6393 } from '@/types/config/languages'
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
  pinStateChanged: (data: { isPinned: boolean }) => void
  getPinState: () => boolean
  returnPinState: (data: { isPinned: boolean }) => void
  setTargetLanguage: (data: { langCodeISO6393: LangCodeISO6393 }) => void
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
