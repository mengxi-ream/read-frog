import type { FeatureProviderAnalytics } from "@/types/analytics"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"

type NoteSuggestionAnalyticsInput = {
  startedAt?: number
  provider?: FeatureProviderAnalytics
} & ({ action_id: "suggestion_shown" } | { action_id: "suggestion_accepted"; action_name: string })

export function trackNoteSuggestionEvent(input: NoteSuggestionAnalyticsInput) {
  const context = createFeatureUsageContext(
    ANALYTICS_FEATURE.NOTE_SUGGESTION,
    ANALYTICS_SURFACE.SELECTION_TOOLBAR,
    input.startedAt ?? Date.now(),
  )
  const provider = input.provider ?? UNKNOWN_FEATURE_PROVIDER
  if (input.action_id === "suggestion_shown") {
    void trackFeatureUsed({
      ...context,
      ...provider,
      action_id: "suggestion_shown",
      outcome: "success",
    })
    return
  }
  void trackFeatureUsed({
    ...context,
    ...provider,
    action_id: "suggestion_accepted",
    action_name: input.action_name,
    outcome: "success",
  })
}
