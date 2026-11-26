import type { HostedAiFeature } from "./types"
import type { AnalyticsFeature } from "@/types/analytics"

/**
 * The analytics feature a Built-in AI feature is billed for, to name it in an upgrade
 * link. Language detection runs inside other features and PDF translation lives on the
 * website, so neither names one. A Record, so a feature the contract adds fails the build
 * here until it is mapped.
 */
const ANALYTICS_FEATURE_BY_HOSTED_FEATURE: Record<HostedAiFeature, AnalyticsFeature | undefined> = {
  pageTranslation: "page_translation",
  selectionTranslation: "selection_translation",
  customAction: "custom_ai_action",
  inputTranslation: "input_translation",
  videoSubtitles: "video_subtitles",
  noteSuggestion: "note_suggestion",
  languageDetection: undefined,
  pdfTranslation: undefined,
}

export function getAnalyticsFeatureForHostedFeature(
  feature: HostedAiFeature,
): AnalyticsFeature | undefined {
  return ANALYTICS_FEATURE_BY_HOSTED_FEATURE[feature]
}
