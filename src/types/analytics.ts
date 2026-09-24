import type { LangCodeISO6393 } from "@read-frog/definitions"
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
  text_to_speech: Record<never, never>
  note_suggestion:
    | { action_id: "suggestion_shown" }
    | { action_id: "suggestion_accepted"; action_name: string }
  glossary: { target_language: LangCodeISO6393 }
}

export interface FeatureUsedEventBase extends FeatureProviderAnalytics {
  outcome: AnalyticsOutcome
  latency_ms: number
}

export type FeatureUsedEventPropertiesFor<F extends AnalyticsFeature> = FeatureUsedEventBase & {
  feature: F
  surface: SurfaceByFeature[F]
} & ObservedByFeature[F]

export type FeatureUsedEventProperties = {
  [F in AnalyticsFeature]: FeatureUsedEventPropertiesFor<F>
}[AnalyticsFeature]
