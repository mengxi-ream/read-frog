import type { AllProviderTypes } from "@/types/config/provider"

export const ANALYTICS_FEATURE = {
  PAGE_TRANSLATION: "page_translation",
  SELECTION_TRANSLATION: "selection_translation",
  CUSTOM_AI_ACTION: "custom_ai_action",
  INPUT_TRANSLATION: "input_translation",
  TRANSLATION_HUB: "translation_hub",
  VIDEO_SUBTITLES: "video_subtitles",
  TEXT_TO_SPEECH: "text_to_speech",
  SAVE_SUGGESTION: "save_suggestion",
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

export interface FeatureUsageContext {
  feature: AnalyticsFeature
  surface: AnalyticsSurface
  startedAt: number
  action_id?: string
  action_name?: string
}

export interface FeatureUsedEventProperties extends FeatureProviderAnalytics {
  feature: AnalyticsFeature
  surface: AnalyticsSurface
  outcome: AnalyticsOutcome
  latency_ms: number
  action_id?: string
  action_name?: string
}

export const TRANSLATION_REQUESTED_FEATURE = {
  PAGE_TRANSLATION: "page_translation",
  HOVER_TRANSLATION: "hover_translation",
  SELECTION_TRANSLATION: "selection_translation",
} as const

export type TranslationRequestedFeature =
  (typeof TRANSLATION_REQUESTED_FEATURE)[keyof typeof TRANSLATION_REQUESTED_FEATURE]

export type TranslationBackendKind = AnalyticsBackendKind
export type TranslationConfiguredPrompt = "default" | "custom" | "not_applicable" | "unknown"
export type PromptExposureAge = "not_exposed" | "lt_24h" | "d1_d7" | "gt_7d"

export const PROMPT_EXPERIMENT_COHORT = "new_user_prompt_experiment_v1"

export const PROMPT_EXPERIMENT_VARIANTS = [
  "control",
  "rewrite-after-understanding",
  "precision-rewrite",
  "expressive-translation-master",
] as const

export type PromptExperimentVariant = (typeof PROMPT_EXPERIMENT_VARIANTS)[number]

export type PromptExperimentExcludedReason =
  | "analytics_disabled"
  | "flag_unavailable"
  | "invalid_variant"
  | "custom_prompt_used"

export interface PromptExperimentCohort {
  cohort: typeof PROMPT_EXPERIMENT_COHORT
  installedAt: number
  installVersion: string
  excludedReason?: PromptExperimentExcludedReason
  firstPromptExposureAt?: number
}

export interface TranslationActionContext {
  actionId: string
  feature: TranslationRequestedFeature
  surface: AnalyticsSurface
}

export interface TranslationRequestedProperties {
  feature: TranslationRequestedFeature
  surface: AnalyticsSurface
  backend_kind: TranslationBackendKind
  configured_prompt: TranslationConfiguredPrompt
  cohort: typeof PROMPT_EXPERIMENT_COHORT
  prompt_exposure_age: PromptExposureAge
}

export type TranslationRequestedInput = Pick<
  TranslationRequestedProperties,
  "feature" | "surface" | "backend_kind" | "configured_prompt"
>

export interface TranslationPromptUsedProperties {
  feature: TranslationRequestedFeature
  surface: AnalyticsSurface
  action_id: string
  cohort: typeof PROMPT_EXPERIMENT_COHORT
  prompt_exposure_age: PromptExposureAge
}
