import type { YoutubeTimedText } from "./types"

/**
 * Patterns to filter out noise annotations from subtitles
 * Uses partial matching to handle mixed content like "[Speaker 1] Hello"
 */
const NOISE_PATTERNS = [
  /\[.*?\]/g, // [Music], [Applause], [Speaker 1], etc.
  /\(.*?\)/g, // (Music), (Applause), etc.
]

// Music notes wrap sung lyrics ("♪ lyric line ♪"), so only an event made of notes alone is noise.
const MUSIC_NOTES_PATTERN = /[♪🎵🎶]/gu

function filterNoiseText(text: string): string {
  let result = text
  for (const pattern of NOISE_PATTERNS) {
    result = result.replace(pattern, "")
  }
  return result
}

function hasSpeechText(text: string): boolean {
  return text.replace(MUSIC_NOTES_PATTERN, "").trim().length > 0
}

export function filterNoiseFromEvents(events: YoutubeTimedText[]): YoutubeTimedText[] {
  return events.map((event) => {
    if (!event.segs) return event

    const cleanedSegs = event.segs
      .map((seg) => ({
        ...seg,
        utf8: filterNoiseText(seg.utf8),
      }))
      .filter((seg) => seg.utf8.trim().length > 0)

    // Note-only segs beside sung text are kept: a leading ♪ marks where the lyric line starts.
    const filteredSegs = cleanedSegs.some((seg) => hasSpeechText(seg.utf8)) ? cleanedSegs : []

    return { ...event, segs: filteredSegs }
  })
}
