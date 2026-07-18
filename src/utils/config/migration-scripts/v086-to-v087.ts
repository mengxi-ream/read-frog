/**
 * Migration script from v086 to v087
 * - Retires the frozen v008-to-v009 request-queue default `{capacity: 300,
 *   rate: 5}`: nobody chose those numbers, and a 300-request burst is
 *   pathological on today's providers. ONLY the exact frozen pair is rewritten
 *   (to the current default 60/8) — any user-modified value is untouched.
 *   Applied to both `translate` and `videoSubtitles` (v050-to-v051 copied the
 *   pair there).
 * - Removes LLM language detection: `languageDetection.mode` "llm" becomes
 *   "basic" and `providerId` is dropped. The per-paragraph LLM detection path
 *   bypassed the translation rate limiter entirely and was removed.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function retireFrozenQueueDefaults(section: any): any {
  if (!section || typeof section !== "object") {
    return section
  }
  const requestQueueConfig = section.requestQueueConfig
  if (requestQueueConfig?.capacity === 300 && requestQueueConfig?.rate === 5) {
    return {
      ...section,
      requestQueueConfig: { capacity: 60, rate: 8 },
    }
  }
  return section
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  return {
    ...oldConfig,
    translate: retireFrozenQueueDefaults(oldConfig.translate),
    videoSubtitles: retireFrozenQueueDefaults(oldConfig.videoSubtitles),
    languageDetection: { mode: "basic" },
  }
}
