import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { GlossaryFeatureKey } from "./features"
import type { MatchedTerm } from "./types"
import type { AnalyticsSurface, FeatureProviderAnalytics } from "@/types/analytics"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"

/**
 * Which feature the terms rode in on, in the `surface` slot.
 *
 * The daily cache in `background/analytics.ts` keys on `feature` alone, so only
 * the first glossary application of the day is reported and this says which
 * feature it happened in — the one thing the event could not be reconstructed
 * without.
 */
const GLOSSARY_FEATURE_SURFACE = {
  pageTranslation: ANALYTICS_SURFACE.PAGE_TRANSLATION,
  videoSubtitles: ANALYTICS_SURFACE.VIDEO_SUBTITLES,
  selectionTranslation: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
  inputTranslation: ANALYTICS_SURFACE.INPUT_TRANSLATION,
} as const satisfies Record<GlossaryFeatureKey, AnalyticsSurface>

/**
 * How often one context will report a given feature.
 *
 * Every other feature reports on a user ACTION — a toggle, a selection — so one
 * event per action is one event. This fires per paragraph and per subtitle cue,
 * where a single page can match terms hundreds of times, and the background's
 * daily cache cannot save us: reaching it already costs a message hop, an
 * analytics-enabled storage read and a cache read, on the hottest path in the
 * product (#1881 was a page-translation freeze).
 *
 * An interval rather than a day key so a tab left open across midnight starts
 * reporting again on its own, without this side duplicating the background's
 * day arithmetic and time zone. Five minutes is far below a day, so the
 * background still decides what is actually captured.
 */
const REPORT_INTERVAL_MS = 5 * 60 * 1000

/** Per context, not per tab: a fresh content script starts with a clean slate. */
const lastReportedAt = new Map<AnalyticsSurface, number>()

/**
 * Terms matched and are on their way into a prompt.
 *
 * Called where the terms are RESOLVED rather than inside
 * `appendGlossaryToSystemPrompt`, even though that is the one place the block is
 * assembled, for two reasons. The assembly point runs twice per translation —
 * once on the page to derive the cache key, once in the background to build the
 * request — and the background half cannot report anything, since
 * `trackFeatureUsed` messages the background and `@webext-core/messaging` has no
 * loopback. It also knows neither the feature nor the provider, both of which
 * are already in hand at every resolve site.
 *
 * This counts a glossary APPLICATION, not an LLM call: a paragraph served from
 * the memory tier or the background cache still counts, because the terms are
 * part of that cache identity (`host/translate/translate-text.ts`) and the text
 * the user reads was produced with them. Measuring the request instead would
 * report a heavy glossary user as a light one.
 *
 * Reports `success` because there is no failure mode here — whether the
 * translation itself lands is the host feature's own event to report. A term
 * entering a prompt is engagement either way, which is what
 * `recordFeatureActiveDay` counts it as.
 *
 * `feature` takes the full hosted route so a call site can forward whatever it
 * holds; a route with no glossary of its own (subtitle segmentation, language
 * detection) is simply not in the map and reports nothing.
 */
export function trackGlossaryUsed(
  feature: HostedAiTextStreamRoute,
  terms: readonly MatchedTerm[],
  targetLanguage: LangCodeISO6393,
  provider?: FeatureProviderAnalytics,
): void {
  if (terms.length === 0) return

  const surface =
    feature in GLOSSARY_FEATURE_SURFACE
      ? GLOSSARY_FEATURE_SURFACE[feature as GlossaryFeatureKey]
      : undefined
  if (!surface) return

  const now = Date.now()
  const reportedAt = lastReportedAt.get(surface)
  if (reportedAt !== undefined && now - reportedAt < REPORT_INTERVAL_MS) return
  lastReportedAt.set(surface, now)

  void trackFeatureUsed({
    ...createFeatureUsageContext(ANALYTICS_FEATURE.GLOSSARY, surface),
    ...(provider ?? UNKNOWN_FEATURE_PROVIDER),
    target_language: targetLanguage,
    outcome: "success",
  })
}

/** Test seam — the throttle is module state that would otherwise leak between cases. */
export function resetGlossaryUsageThrottleForTests(): void {
  lastReportedAt.clear()
}
