import type { YoutubeTimedText } from "./types"

/**
 * Patterns to filter out noise annotations from subtitles
 * Uses partial matching to handle mixed content like "[Speaker 1] Hello"
 */
const NOISE_PATTERNS = [
  /\[.*?\]/g, // [Music], [Applause], [Speaker 1], etc.
  /\(.*?\)/g, // (Music), (Applause), etc.
]

// Music notes wrap sung lyrics ("♪ lyric line ♪"), so only a seg made of notes alone is noise.
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

    const filteredSegs = event.segs
      .map((seg) => ({
        ...seg,
        utf8: filterNoiseText(seg.utf8),
      }))
      .filter((seg) => hasSpeechText(seg.utf8))

    return { ...event, segs: filteredSegs }
  })
}
