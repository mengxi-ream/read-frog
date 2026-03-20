export const ANALYTICS_FEATURE = {
  PAGE_TRANSLATION: "page_translation",
  SELECTION_TRANSLATION: "selection_translation",
  CUSTOM_AI_ACTION: "custom_ai_action",
  INPUT_TRANSLATION: "input_translation",
  TRANSLATION_HUB: "translation_hub",
  VIDEO_SUBTITLES: "video_subtitles",
  TEXT_TO_SPEECH: "text_to_speech",
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
  TTS_SETTINGS: "tts_settings",
} as const

export type AnalyticsSurface = (typeof ANALYTICS_SURFACE)[keyof typeof ANALYTICS_SURFACE]

export type AnalyticsOutcome = "success" | "failure"

export interface FeatureUsageContext {
  feature: AnalyticsFeature
  surface: AnalyticsSurface
  startedAt: number
  action_id?: string
  action_name?: string
}

export interface FeatureUsedEventProperties {
  feature: AnalyticsFeature
  surface: AnalyticsSurface
  outcome: AnalyticsOutcome
  latency_ms: number
  action_id?: string
  action_name?: string
}
