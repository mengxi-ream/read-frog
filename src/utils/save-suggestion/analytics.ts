import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { BUILT_IN_AI_FEATURE_PROVIDER } from "@/utils/analytics-provider"

export type SaveSuggestionAnalyticsAction = "suggestion_shown" | "suggestion_accepted"

export function trackSaveSuggestionEvent(
  actionId: SaveSuggestionAnalyticsAction,
  options: { startedAt?: number; actionName?: string } = {},
) {
  void trackFeatureUsed({
    ...createFeatureUsageContext(
      ANALYTICS_FEATURE.SAVE_SUGGESTION,
      ANALYTICS_SURFACE.SELECTION_TOOLBAR,
      options.startedAt ?? Date.now(),
      {
        action_id: actionId,
        ...(options.actionName !== undefined ? { action_name: options.actionName } : {}),
      },
    ),
    ...BUILT_IN_AI_FEATURE_PROVIDER,
    outcome: "success",
  })
}
