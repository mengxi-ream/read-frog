import { ANALYTICS_FEATURE } from "@/types/analytics"
import { recordFeatureActiveDay } from "@/utils/feature-active-days"
import { onMessage } from "@/utils/message"
import { getAnalyticsSiteDomain } from "@/utils/url"
import { captureFeatureUsedEventInBackground } from "./analytics"
import { getPageAnalyticsContext } from "./page-analytics-context"

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

    // Derived from the sender's top-level tab rather than trusted from the payload,
    // so it reflects the site the user is on even when the feature ran in an iframe.
    // Extension pages (popup, options, translation hub) have no http(s) tab URL.
    const tabId = message.sender?.tab?.id
    const pageContext =
      message.data.feature === ANALYTICS_FEATURE.PAGE_TRANSLATION && typeof tabId === "number"
        ? await getPageAnalyticsContext(tabId).catch(() => ({}))
        : {}

    await captureFeatureUsedEventInBackground(message.data, {
      siteDomain: getAnalyticsSiteDomain(message.sender?.tab?.url),
      pageContext,
    })
  })
}
