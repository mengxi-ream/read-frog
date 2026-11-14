import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { toSubtitlesFragments } from "../fragments"

const HOUR_MS = 60 * 60 * 1000
const END_SLACK_MS = 5000

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
// Take off that hour, or as many as a later start needs to bring the cues inside the video.
export function alignToVideo(
  fragments: SubtitlesFragment[],
  durationSec: number,
): SubtitlesFragment[] {
  const firstStart = fragments[0]?.start ?? 0
  const lastEnd = fragments.reduce((latest, fragment) => Math.max(latest, fragment.end), 0)
  const overrunHours = Math.ceil((lastEnd - durationSec * 1000 - END_SLACK_MS) / HOUR_MS)
  const hours = Math.max(1, overrunHours)
  if (!Number.isFinite(durationSec) || hours * HOUR_MS > firstStart) {
    return fragments
  }

  const offset = hours * HOUR_MS
  return fragments.map((fragment) => ({
    ...fragment,
    start: fragment.start - offset,
    end: fragment.end - offset,
  }))
}
