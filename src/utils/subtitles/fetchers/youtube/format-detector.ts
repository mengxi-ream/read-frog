import type { YoutubeTimedText } from "./types"

export type SubtitleFormat = "karaoke" | "scrolling-asr" | "standard"

/**
 * Detect karaoke format subtitles
 * Feature: multiple events at the same timestamp (different wpWinPosId)
 */
function isKaraokeFormat(events: YoutubeTimedText[]): boolean {
  if (events.length < 2)
    return false

  const timeMap = new Map<number, number>()
  for (const event of events) {
    if (event.wpWinPosId !== undefined) {
      const count = timeMap.get(event.tStartMs) || 0
      timeMap.set(event.tStartMs, count + 1)
      if (count >= 1)
        return true
    }
  }
  return false
}

/**
 * Detect ASR scrolling subtitle format
 * Feature: events with wWinId and aAppend: 1
 */
function isScrollingAsrFormat(events: YoutubeTimedText[]): boolean {
  return events.some(e => e.wWinId !== undefined && e.aAppend === 1)
}

/**
 * Detect subtitle format type
 */
export function detectFormat(events: YoutubeTimedText[]): SubtitleFormat {
  if (!events || events.length === 0)
    return "standard"

  if (isKaraokeFormat(events))
    return "karaoke"

  if (isScrollingAsrFormat(events))
    return "scrolling-asr"

  return "standard"
}
