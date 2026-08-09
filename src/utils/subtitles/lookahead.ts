import { MAX_LOOKAHEAD_RATE } from "@/utils/constants/subtitles"

export function effectiveLookAheadMs(baseMs: number, playbackRate: number | undefined): number {
  const rate = Math.min(Math.max(playbackRate || 1, 1), MAX_LOOKAHEAD_RATE)
  return baseMs * rate
}
