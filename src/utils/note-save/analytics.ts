import type { NoteSaveSurface } from "@read-frog/definitions"
import type { AnalyticsFailureReason, NoteSavePath } from "@/types/analytics"
import type { FeatureUsedEventInput } from "@/utils/analytics"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"

interface NoteSaveDetails {
  saveSource: NoteSaveSurface
  noteCount: number
}

export interface NoteSaveCompletion extends NoteSaveDetails {
  path: NoteSavePath
  isGuide: boolean
  /** When the user clicked save, so latency covers any login round trip. */
  startedAt: number
  /** Set when the save failed. */
  failureReason?: AnalyticsFailureReason
}

/** The user asked to save; whether the notes reached the server is reported separately. */
export function trackNoteSaveRequested({ saveSource, noteCount }: NoteSaveDetails): void {
  void trackFeatureUsed({
    ...createFeatureUsageContext(ANALYTICS_FEATURE.NOTE_SAVE, ANALYTICS_SURFACE.SELECTION_TOOLBAR),
    ...UNKNOWN_FEATURE_PROVIDER,
    action_id: "save_requested",
    save_source: saveSource,
    note_count: noteCount,
    outcome: "success",
  })
}

export function createNoteSaveCompletedEvent(
  completion: NoteSaveCompletion,
): FeatureUsedEventInput {
  const event = {
    ...createFeatureUsageContext(
      ANALYTICS_FEATURE.NOTE_SAVE,
      ANALYTICS_SURFACE.SELECTION_TOOLBAR,
      completion.startedAt,
    ),
    ...UNKNOWN_FEATURE_PROVIDER,
    action_id: "save_completed" as const,
    save_source: completion.saveSource,
    note_count: completion.noteCount,
    path: completion.path,
    is_guide: completion.isGuide,
  }

  return completion.failureReason
    ? { ...event, outcome: "failure", failure_reason: completion.failureReason }
    : { ...event, outcome: "success" }
}

/** For saves that finish in a content script; the background reports its own. */
export function trackNoteSaveCompleted(completion: NoteSaveCompletion): void {
  void trackFeatureUsed(createNoteSaveCompletedEvent(completion))
}
