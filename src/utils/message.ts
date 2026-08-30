import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { GuideDictionaryNotebaseCompletionInput } from "./guide/dictionary-notebase"
import type { FeatureUsageContext, FeatureUsedEventProperties } from "@/types/analytics"
import type {
  BackgroundGenerateTextPayload,
  BackgroundGenerateTextResponse,
} from "@/types/background-generate-text"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { TranslationTextFormat } from "@/types/config/translate"
import type {
  EdgeTTSHealthStatus,
  EdgeTTSSynthesizeRequest,
  EdgeTTSSynthesizeWireResponse,
} from "@/types/edge-tts"
import type { ProxyRequest, ProxyResponse } from "@/types/proxy-fetch"
import type {
  TTSPlaybackStartRequest,
  TTSPlaybackStartResponse,
  TTSPlaybackStopRequest,
} from "@/types/tts-playback"
import type { HostedAiStatus } from "@/utils/hosted-ai/types"
import type { PromptableProviderRef, SerializableProviderRef } from "@/utils/providers/provider-ref"
import type { EdgeTTSVoice } from "@/utils/server/edge-tts/types"
import { defineExtensionMessaging } from "@webext-core/messaging"

interface ProtocolMap {
  // navigation
  openPage: (data: { url: string; active?: boolean }) => void
  openOptionsPage: (data?: { route?: `/${string}` }) => void
  toggleSidePanel: (data?: { source?: "content-script" | "extension-user-action" }) => Promise<
    | { ok: true; action: "opened" | "closed" }
    | {
        ok: false
        reason:
          | "missing-window"
          | "unsupported"
          | "toggle-failed"
          | "requires-extension-user-action"
      }
  >
  // config
  getInitialConfig: () => Config | null
  // translation state
  getEnablePageTranslationByTabId: (data: { tabId: number }) => boolean | undefined
  getEnablePageTranslationFromContentScript: () => Promise<boolean>
  tryToSetEnablePageTranslationByTabId: (data: {
    tabId: number
    enabled: boolean
    analyticsContext?: FeatureUsageContext
  }) => void
  tryToSetEnablePageTranslationOnContentScript: (data: {
    enabled: boolean
    analyticsContext?: FeatureUsageContext
  }) => void
  setAndNotifyPageTranslationStateChangedByManager: (data: {
    enabled: boolean
    url?: string
    userInitiated?: boolean
  }) => void
  notifyTranslationStateChanged: (data: { enabled: boolean }) => void
  ensureIframeHostContentInjected: (data: { tabId?: number }) => void
  injectCurrentIframesAfterTopFrameNodeTranslation: () => void
  reportDetectedPageLanguage: (data: {
    detectedCodeOrUnd: LangCodeISO6393 | "und"
    url: string
  }) => void
  refreshDetectedPageLanguage: () => void
  getDetectedCode: () => LangCodeISO6393
  detectedPageLanguageChanged: (data: { detectedCode: LangCodeISO6393 }) => void
  // ask host to start page translation
  askManagerToTogglePageTranslation: (data: {
    enabled: boolean
    analyticsContext?: FeatureUsageContext
  }) => void
  openSelectionTranslationFromContextMenu: (data: { selectionText: string }) => void
  openSelectionCustomActionFromContextMenu: (data: {
    actionId: string
    selectionText: string
  }) => void
  readAloudSelectionFromContextMenu: (data: { selectionText: string }) => void
  // analytics
  trackFeatureUsedEvent: (data: FeatureUsedEventProperties) => void
  // user guide
  pinStateChanged: (data: { isPinned: boolean }) => void
  getPinState: () => boolean
  returnPinState: (data: { isPinned: boolean }) => void
  guideDictionaryNotebaseStateChanged: (data: { completed: boolean }) => void
  completeGuideDictionaryNotebase: (data: GuideDictionaryNotebaseCompletionInput) => void
  // request
  enqueueTranslateRequest: (data: {
    text: string
    langConfig: Config["language"]
    providerRef: SerializableProviderRef
    scheduleAt: number
    hash: string
    textFormat?: TranslationTextFormat
    // Source line breaks are semantic (newline-preserving container or typed
    // input); providers whose transport collapses "\n" must protect them.
    preserveLineBreaks?: boolean
    webTitle?: string | null
    webDescription?: string | null
    webContent?: string | null
    webSummary?: string | null
    // Page-translation session this request belongs to; scopes the request
    // for cancelPageTranslationRequests. Absent for non-page requests
    // (input/selection translation), which are never cancellable.
    sessionId?: string
    forceRetranslation?: boolean
    // Which hosted route a system provider bills against (input translation
    // shares the webpage queue but draws on its own quota). Optional on the
    // wire so a pre-update content script keeps working against an updated
    // service worker; absent falls back to the queue's default route.
    hostedFeature?: HostedAiTextStreamRoute
  }) => Promise<string>
  // Drain queued/in-flight page-translation requests of one session (#1881).
  // The background composes the scope as `${sender.tab.id}:${sessionId}`, so a
  // tab can only ever cancel its own requests.
  cancelPageTranslationRequests: (data: { sessionId: string }) => void
  getOrGenerateWebPageSummary: (data: {
    webTitle: string
    webContent: string
    // A summary is a generation: the payload type forces senders to narrow,
    // and the handler re-checks because the wire is a trust boundary.
    providerRef: PromptableProviderRef
    // The route of the feature that triggered the summary — the summary is a
    // sub-call of that feature and bills against its quota. Optional on the
    // wire for mid-extension-update compat; absent means "pageTranslation",
    // the historical biller.
    hostedFeature?: HostedAiTextStreamRoute
  }) => Promise<string | null>
  enqueueSubtitlesTranslateRequest: (data: {
    text: string
    langConfig: Config["language"]
    providerRef: SerializableProviderRef
    scheduleAt: number
    hash: string
    webTitle?: string | null
    webDescription?: string | null
    summary?: string | null
  }) => Promise<string>
  getSubtitlesSummary: (data: {
    videoTitle: string
    subtitlesContext: string
    providerRef: PromptableProviderRef
  }) => Promise<string | null>
  getVideoSummary: (data: {
    transcript: string
    targetLanguage: string
    providerRef: PromptableProviderRef
  }) => Promise<string | null>
  backgroundGenerateText: (
    data: BackgroundGenerateTextPayload,
  ) => Promise<BackgroundGenerateTextResponse>
  // AI subtitle segmentation
  aiSegmentSubtitles: (data: {
    jsonContent: string
    providerRef: PromptableProviderRef
  }) => Promise<string>
  // Hosted AI availability. Owned by the background because one response covers
  // every feature and tier — so it can be cached and shared across tabs — and
  // because content scripts cannot read the session storage that cache lives in.
  // Null means "no verdict" (fetch failed); callers fail open on it.
  getHostedAiStatus: () => Promise<HostedAiStatus | null>
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
  ttsPlaybackPrepare: () => Promise<{ ok: true }>
  ttsPlaybackStart: (data: TTSPlaybackStartRequest) => Promise<TTSPlaybackStartResponse>
  ttsPlaybackStop: (data: TTSPlaybackStopRequest) => Promise<{ ok: true }>
  // offscreen internal
  ttsOffscreenPlay: (data: TTSPlaybackStartRequest) => Promise<TTSPlaybackStartResponse>
  ttsOffscreenStop: (data: TTSPlaybackStopRequest) => Promise<{ ok: true }>
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()
