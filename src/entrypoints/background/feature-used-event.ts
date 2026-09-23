import { recordFeatureActiveDay } from "@/utils/feature-active-days"
import { onMessage } from "@/utils/message"
import { captureFeatureUsedEventInBackground } from "./analytics"

/**
 * Sole subscriber to the feature-used event, fanning it out to the two consumers that
 * care about it. Sole is not a preference: `@webext-core/messaging` throws if a message
 * key is registered twice in one JS context.
 *
 * Active days are counted here rather than inside the analytics capture because that
 * path returns early on the analytics opt-in, which defaults off on Firefox. Routing
 * engagement through it would freeze the count at zero for exactly the people who are
 * still using the extension — opting out of telemetry is not the same as stopping.
 *
 * Failures are skipped: someone whose provider has been erroring for days is the last
 * person to ask for a store review.
 */
export function setupFeatureUsedEventHandlers(): void {
  onMessage("trackFeatureUsedEvent", async (message) => {
    if (message.data.outcome === "success") {
      void recordFeatureActiveDay()
    }

    // The sender's top-level tab, not anything from the payload, identifies the page:
    // it reflects the site the user is on even when the feature ran in an iframe.
    await captureFeatureUsedEventInBackground(message.data, message.sender?.tab)
  })
}
