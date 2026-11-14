import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { toSubtitlesFragments } from "../fragments"

const HOUR_MS = 60 * 60 * 1000

function readCueText(cue: TextTrackCue): string {
  return "text" in cue && typeof cue.text === "string" ? cue.text : ""
}

export function cuesToFragments(cues: ArrayLike<TextTrackCue>): SubtitlesFragment[] {
  return toSubtitlesFragments(
    Array.from(cues, (cue) => ({
      text: readCueText(cue),
      start: Math.round(cue.startTime * 1000),
      end: Math.round(cue.endTime * 1000),
    })),
  )
}

// Broadcast captions count from 01:00:00; X's player drops that hour, its text track keeps it.
export function alignToVideo(
  fragments: SubtitlesFragment[],
  durationSec: number,
): SubtitlesFragment[] {
  const lastEnd = fragments.reduce((latest, fragment) => Math.max(latest, fragment.end), 0)
  if (!Number.isFinite(durationSec) || lastEnd <= durationSec * 1000) {
    return fragments
  }

  const offset = Math.floor((fragments[0]?.start ?? 0) / HOUR_MS) * HOUR_MS
  return offset === 0
    ? fragments
    : fragments.map((fragment) => ({
        ...fragment,
        start: fragment.start - offset,
        end: fragment.end - offset,
      }))
}
