import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { toSubtitlesFragments } from "../fragments"

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
