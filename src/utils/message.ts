import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { FeatureUsageContext, FeatureUsedEventProperties } from "@/types/analytics"
import type {
  BackgroundGenerateTextPayload,
  BackgroundGenerateTextResponse,
} from "@/types/background-generate-text"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { BatchQueueConfig, RequestQueueConfig } from "@/types/config/translate"
import type {
  EdgeTTSHealthStatus,
  EdgeTTSSynthesizeRequest,
  EdgeTTSSynthesizeWireResponse,
} from "@/types/edge-tts"
import type { ProxyRequest, ProxyResponse } from "@/types/proxy-fetch"
import type {
  TTSOffscreenStopRequest,
  TTSPlaybackStartRequest,
  TTSPlaybackStartResponse,
  TTSPlaybackStopRequest,
} from "@/types/tts-playback"
import type { EdgeTTSVoice } from "@/utils/server/edge-tts/types"
import { defineExtensionMessaging } from "@webext-core/messaging"

interface ProtocolMap {
  // navigation
  openPage: (data: { url: string, active?: boolean }) => void
  openOptionsPage: () => void
  // config
  getInitialConfig: () => Config | null
  // translation state
  getEnablePageTranslationByTabId: (data: { tabId: number }) => boolean | undefined
  getEnablePageTranslationFromContentScript: () => Promise<boolean>
  tryToSetEnablePageTranslationByTabId: (data: { tabId: number, enabled: boolean, analyticsContext?: FeatureUsageContext }) => void
  tryToSetEnablePageTranslationOnContentScript: (data: { enabled: boolean, analyticsContext?: FeatureUsageContext }) => void
  setAndNotifyPageTranslationStateChangedByManager: (data: { enabled: boolean }) => void
  notifyTranslationStateChanged: (data: { enabled: boolean }) => void
  // for auto start page translation
  checkAndAskAutoPageTranslation: (data: { url: string, detectedCodeOrUnd: LangCodeISO6393 | "und" }) => void
  // ask host to start page translation
  askManagerToTogglePageTranslation: (data: { enabled: boolean, analyticsContext?: FeatureUsageContext }) => void
  openSelectionTranslationFromContextMenu: (data: { selectionText: string }) => void
  openSelectionCustomActionFromContextMenu: (data: { actionId: string, selectionText: string }) => void
  // analytics
  trackFeatureUsedEvent: (data: FeatureUsedEventProperties) => void
  // user guide
  pinStateChanged: (data: { isPinned: boolean }) => void
  getPinState: () => boolean
  returnPinState: (data: { isPinned: boolean }) => void
  // request
  enqueueTranslateRequest: (data: { text: string, langConfig: Config["language"], providerConfig: ProviderConfig, scheduleAt: number, hash: string, webTitle?: string | null, webContent?: string | null, webSummary?: string | null }) => Promise<string>
  getOrGenerateWebPageSummary: (data: { webTitle: string, webContent: string, providerConfig: ProviderConfig }) => Promise<string | null>
  enqueueSubtitlesTranslateRequest: (data: { text: string, langConfig: Config["language"], providerConfig: ProviderConfig, scheduleAt: number, hash: string, videoTitle?: string | null, summary?: string | null }) => Promise<string>
  getSubtitlesSummary: (data: { videoTitle: string, subtitlesContext: string, providerConfig: ProviderConfig }) => Promise<string | null>
  backgroundGenerateText: (data: BackgroundGenerateTextPayload) => Promise<BackgroundGenerateTextResponse>
  // AI subtitle segmentation
  aiSegmentSubtitles: (data: { jsonContent: string, providerId: string }) => Promise<string>
  setTranslateRequestQueueConfig: (data: Partial<RequestQueueConfig>) => void
  setTranslateBatchQueueConfig: (data: Partial<BatchQueueConfig>) => void
  // Subtitle-specific queue config messages
  setSubtitlesRequestQueueConfig: (data: Partial<RequestQueueConfig>) => void
  setSubtitlesBatchQueueConfig: (data: Partial<BatchQueueConfig>) => void
  // network proxy
  backgroundFetch: (data: ProxyRequest) => Promise<ProxyResponse>
  // cache management
  clearAllTranslationRelatedCache: () => Promise<void>
  clearAiSegmentationCache: () => Promise<void>
  // edge tts
  edgeTtsSynthesize: (data: EdgeTTSSynthesizeRequest) => Promise<EdgeTTSSynthesizeWireResponse>
  edgeTtsListVoices: () => Promise<EdgeTTSVoice[]>
  edgeTtsHealthCheck: () => Promise<EdgeTTSHealthStatus>
  // tts playback
  ttsPlaybackEnsureOffscreen: () => Promise<{ ok: true }>
  ttsPlaybackStart: (data: TTSPlaybackStartRequest) => Promise<TTSPlaybackStartResponse>
  ttsPlaybackStop: (data: TTSPlaybackStopRequest) => Promise<{ ok: true }>
  // offscreen internal
  ttsOffscreenPlay: (data: TTSPlaybackStartRequest) => Promise<TTSPlaybackStartResponse>
  ttsOffscreenStop: (data: TTSOffscreenStopRequest) => Promise<{ ok: true }>
}

export const { sendMessage, onMessage }
  = defineExtensionMessaging<ProtocolMap>()
