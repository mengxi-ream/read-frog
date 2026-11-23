import { MAX_LOOKAHEAD_RATE } from "@/utils/constants/subtitles"

export function effectiveLookAheadMs(baseMs: number, playbackRate: number | undefined): number {
  const rate = Math.min(Math.max(playbackRate || 1, 1), MAX_LOOKAHEAD_RATE)
  return baseMs * rate
}

/** 0 preserves adaptive look-ahead; -1 opts in to the complete available subtitle track. */
export function configuredLookAheadMs(
  baseMs: number,
  playbackRate: number | undefined,
  prefetchMinutes: number,
): number {
  if (prefetchMinutes === -1) return Number.POSITIVE_INFINITY
  return Math.max(effectiveLookAheadMs(baseMs, playbackRate), Math.max(0, prefetchMinutes) * 60_000)
}
