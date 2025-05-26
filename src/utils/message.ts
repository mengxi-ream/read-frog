import type { LangCodeISO6393 } from '@/types/config/languages'
import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
  openOptionsPage: () => void
  // translation state
  getEnablePageTranslation: (data: { tabId: number }) => boolean | undefined
  setEnablePageTranslation: (data: { tabId: number, enabled: boolean }) => void
  setEnablePageTranslationOnContentScript: (data: { enabled: boolean }) => void
  // read article
  readArticle: () => void
  popupRequestReadArticle: (data: { tabId: number }) => void
  // user guide
  pinStateChanged: (data: { isPinned: boolean }) => void
  getPinState: () => boolean
  returnPinState: (data: { isPinned: boolean }) => void
  setTargetLanguage: (data: { langCodeISO6393: LangCodeISO6393 }) => void
  getTargetLanguage: () => LangCodeISO6393 | undefined
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
