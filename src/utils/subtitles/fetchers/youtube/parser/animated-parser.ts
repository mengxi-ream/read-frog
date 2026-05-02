import type { SubtitlesFragment } from "../../../types"
import type { YoutubeTimedText } from "../types"

const ZERO_WIDTH_SPACE_PATTERN = /\u200B/g
const WHITESPACE_PATTERN = /\s+/g

function getEventText(event: YoutubeTimedText): string {
  return (event.segs ?? [])
    .map(seg => seg.utf8 || "")
    .join("")
    .replace(ZERO_WIDTH_SPACE_PATTERN, "")
    .replace(WHITESPACE_PATTERN, " ")
    .trim()
}

export function parseAnimatedSubtitles(events: YoutubeTimedText[]): SubtitlesFragment[] {
  const fragments: SubtitlesFragment[] = []

  for (const event of events) {
    const text = getEventText(event)
    if (!text)
      continue

    const start = event.tStartMs
    const end = start + (event.dDurationMs ?? 0)
    const last = fragments.at(-1)

    if (last && last.text === text) {
      last.end = end
    }
    else {
      if (last && last.end > start)
        last.end = start
      fragments.push({ text, start, end })
    }
  }

  return fragments
}
