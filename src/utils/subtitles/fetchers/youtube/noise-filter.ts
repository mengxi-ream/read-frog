import type { YoutubeTimedText } from "./types"

/**
 * Patterns to filter out noise annotations from subtitles
 * Uses partial matching to handle mixed content like "[Speaker 1] Hello"
 */
const NOISE_PATTERNS = [
  /\[.*?\]/g, // [Music], [Applause], [Speaker 1], etc.
  /\(.*?\)/g, // (Music), (Applause), etc.
  /♪.*?♪/g, // ♪ Music ♪
  /🎵.*?🎵/g, // 🎵 Music 🎵
  /🎶.*?🎶/g, // 🎶 Music 🎶
]

function filterNoiseText(text: string): string {
  let result = text
  for (const pattern of NOISE_PATTERNS) {
    result = result.replace(pattern, "")
  }
  return result
}

export function filterNoiseFromEvents(events: YoutubeTimedText[]): YoutubeTimedText[] {
  return events.map((event) => {
    if (!event.segs)
      return event

    const filteredSegs = event.segs
      .map(seg => ({
        ...seg,
        utf8: filterNoiseText(seg.utf8),
      }))
      .filter(seg => seg.utf8.trim().length > 0)

    return { ...event, segs: filteredSegs }
  })
}
