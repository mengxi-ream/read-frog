import type { SubtitlesFragment } from "../../../types"
import type { YoutubeTimedText } from "../types"

// YouTube uses wpWinPosId: 3 for the main kanji track in karaoke subtitles
const KANJI_TRACK_ID = 3

/**
 * Clean karaoke text: remove zero-width spaces and extra whitespace
 */
function cleanKaraokeText(text: string): string {
  return text
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Parse karaoke format subtitles
 * 1. Select main track (prefer kanji wpWinPosId: 3)
 * 2. Merge segs for each event
 * 3. Deduplicate adjacent identical text
 */
export function parseKaraokeSubtitles(events: YoutubeTimedText[]): SubtitlesFragment[] {
  // Find all wpWinPosId values
  const posIds = new Set<number>()
  for (const event of events) {
    if (event.wpWinPosId !== undefined) {
      posIds.add(event.wpWinPosId)
    }
  }

  // Prefer kanji track, otherwise use the largest id
  const mainTrackId = posIds.has(KANJI_TRACK_ID) ? KANJI_TRACK_ID : Math.max(...posIds)

  // Filter and merge
  const merged: SubtitlesFragment[] = []
  for (const event of events) {
    if (event.wpWinPosId !== mainTrackId)
      continue
    if (!event.segs || event.segs.length === 0)
      continue

    const text = cleanKaraokeText(event.segs.map(s => s.utf8 || "").join(""))
    if (!text)
      continue

    // Fix previous fragment's end time to avoid overlap
    const last = merged[merged.length - 1]
    if (last && last.end > event.tStartMs) {
      last.end = event.tStartMs
    }

    merged.push({
      text,
      start: event.tStartMs,
      end: event.tStartMs + (event.dDurationMs ?? 0),
    })
  }

  // Deduplicate: merge time ranges for adjacent identical text
  const result: SubtitlesFragment[] = []
  for (const fragment of merged) {
    const last = result[result.length - 1]
    if (last && last.text === fragment.text) {
      last.end = fragment.end
    }
    else {
      result.push({ ...fragment })
    }
  }

  return result
}
