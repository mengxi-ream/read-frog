import { recordFeatureActiveDay } from "@/utils/feature-active-days"
import { onMessage } from "@/utils/message"
import { captureFeatureUsedEventInBackground } from "./analytics"

/**
 * Sole subscriber to the feature-used domain event, fanning it out to the independent
 * consumers that care about it. It has to be sole: `@webext-core/messaging` throws if a
 * message key is registered twice in one JS context.
 */
export function setupFeatureUsedEventHandlers(): void {
  onMessage("trackFeatureUsedEvent", async (message) => {
    // Engagement is counted independently of the analytics opt-in. Telemetry defaults
    // off on Firefox and any user can turn it off, and neither means they stopped using
    // the extension — routing this through analytics would silently freeze the count for
    // exactly those people.
    //
    // Failures are excluded on purpose: someone whose provider has been erroring for
    // days is the last person who should be asked for a store review.
    if (message.data.outcome === "success") {
      void recordFeatureActiveDay()
    }

    await captureFeatureUsedEventInBackground(message.data)
  })
}
