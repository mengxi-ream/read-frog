import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { decodeHTML } from "entities"

const CUE_TAG_PATTERN = /<[^>]+>/g

export function cleanCueText(text: string): string {
  return decodeHTML(text)
    .replace(CUE_TAG_PATTERN, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

function readCueText(cue: TextTrackCue): string {
  return "text" in cue && typeof cue.text === "string" ? cue.text : ""
}

export function cuesToFragments(cues: ArrayLike<TextTrackCue>): SubtitlesFragment[] {
  return Array.from(cues)
    .flatMap((cue) => {
      const text = cleanCueText(readCueText(cue))
      const start = Math.round(cue.startTime * 1000)
      const end = Math.round(cue.endTime * 1000)
      return text && end > start ? [{ text, start, end }] : []
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)
}
