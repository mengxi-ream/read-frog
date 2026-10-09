import type { LangCodeISO6393, NoteSaveSurface } from "@read-frog/definitions"
import type { AllProviderTypes } from "@/types/config/provider"
import type { TranslationMode } from "@/types/config/translate"

export const ANALYTICS_FEATURE = {
  PAGE_TRANSLATION: "page_translation",
  SELECTION_TRANSLATION: "selection_translation",
  CUSTOM_AI_ACTION: "custom_ai_action",
  INPUT_TRANSLATION: "input_translation",
  TRANSLATION_HUB: "translation_hub",
  VIDEO_SUBTITLES: "video_subtitles",
  TEXT_TO_SPEECH: "text_to_speech",
  NOTE_SUGGESTION: "note_suggestion",
  NOTE_SAVE: "note_save",
  GLOSSARY: "glossary",
} as const

export type AnalyticsFeature = (typeof ANALYTICS_FEATURE)[keyof typeof ANALYTICS_FEATURE]

export const ANALYTICS_FEATURES = Object.values(ANALYTICS_FEATURE)

export const ANALYTICS_SURFACE = {
  POPUP: "popup",
  FLOATING_BUTTON: "floating_button",
  CONTEXT_MENU: "context_menu",
  PAGE_AUTO: "page_auto",
  SHORTCUT: "shortcut",
  TOUCH_GESTURE: "touch_gesture",
  SELECTION_TOOLBAR: "selection_toolbar",
  INPUT_TRANSLATION: "input_translation",
  TRANSLATION_HUB: "translation_hub",
  VIDEO_SUBTITLES: "video_subtitles",
  VIDEO_SUBTITLES_AUTO: "video_subtitles_auto",
  PAGE_TRANSLATION: "page_translation",
  TTS_SETTINGS: "tts_settings",
} as const

export type AnalyticsSurface = (typeof ANALYTICS_SURFACE)[keyof typeof ANALYTICS_SURFACE]

export type AnalyticsOutcome = "success" | "failure"

/** Why a failed attempt failed, so a broken setup can be told from a provider outage. */
export const ANALYTICS_FAILURE_REASONS = [
  "precheck",
  "missing_api_key",
  "auth_required",
  "tier_restricted",
  "quota_exceeded",
  "rate_limited",
  "provider_auth",
  "provider_error",
  "invalid_output",
  "network",
  "note_limit",
  "not_found",
  "validation",
  // The user closed the save dialog without saving or logging in.
  "dismissed",
  "unknown",
] as const

export type AnalyticsFailureReason = (typeof ANALYTICS_FAILURE_REASONS)[number]

/** How a Notebase save reached the server. */
export const NOTE_SAVE_PATHS = ["direct", "create_notebase", "after_login"] as const

export type NoteSavePath = (typeof NOTE_SAVE_PATHS)[number]

export const ANALYTICS_PROVIDER = {
  BUILT_IN_AI: "read-frog-built-in-ai",
  EDGE_TTS: "edge-tts",
  UNKNOWN: "unknown",
} as const

export type AnalyticsProvider =
  | AllProviderTypes
  | (typeof ANALYTICS_PROVIDER)[keyof typeof ANALYTICS_PROVIDER]

export type AnalyticsBackendKind = "llm" | "non_llm" | "unknown"

export interface FeatureProviderAnalytics {
  provider: AnalyticsProvider
  backend_kind: AnalyticsBackendKind
}

export interface SurfaceByFeature {
  page_translation:
    | "popup"
    | "floating_button"
    | "context_menu"
    | "page_auto"
    | "shortcut"
    | "touch_gesture"
  selection_translation: "selection_toolbar" | "context_menu" | "shortcut"
  custom_ai_action: "selection_toolbar" | "context_menu"
  input_translation: "input_translation"
  translation_hub: "translation_hub"
  video_subtitles: "video_subtitles" | "video_subtitles_auto" | "shortcut"
  text_to_speech: "selection_toolbar" | "context_menu" | "tts_settings" | "translation_hub"
  note_suggestion: "selection_toolbar"
  note_save: "selection_toolbar"
  glossary: "page_translation" | "video_subtitles" | "selection_toolbar" | "input_translation"
}

export type FeatureUsageContext<F extends AnalyticsFeature = AnalyticsFeature> = {
  feature: F
  surface: SurfaceByFeature[F]
  startedAt: number
}

export interface ObservedByFeature {
  page_translation: {
    translation_mode: TranslationMode
    target_language: LangCodeISO6393
    source_language?: LangCodeISO6393
  }
  selection_translation: { char_count: number; target_language: LangCodeISO6393 }
  custom_ai_action: { action_id: string; action_name?: string }
  input_translation: { char_count: number; target_language: LangCodeISO6393 }
  translation_hub: { char_count: number; target_language: LangCodeISO6393 }
  video_subtitles: { target_language: LangCodeISO6393 }
  text_to_speech: unknown
  note_suggestion:
    | { action_id: "suggestion_shown" }
    | { action_id: "suggestion_accepted"; action_name: string }
  note_save:
    | { action_id: "save_requested"; save_source: NoteSaveSurface; note_count: number }
    | {
        action_id: "save_completed"
        save_source: NoteSaveSurface
        note_count: number
        path: NoteSavePath
        is_guide: boolean
      }
  glossary: { target_language: LangCodeISO6393 }
}

export interface FeatureUsedEventBase extends FeatureProviderAnalytics {
  outcome: AnalyticsOutcome
  latency_ms: number
  /** Only on failures; omitted when the caller cannot tell. */
  failure_reason?: AnalyticsFailureReason
}

export type FeatureUsedEventPropertiesFor<F extends AnalyticsFeature> = FeatureUsedEventBase & {
  feature: F
  surface: SurfaceByFeature[F]
} & ObservedByFeature[F]

export type FeatureUsedEventProperties = {
  [F in AnalyticsFeature]: FeatureUsedEventPropertiesFor<F>
}[AnalyticsFeature]
