import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { decodeHTML } from "entities"

const CUE_TAG_PATTERN = /<[^>]+>/g

function cleanCueText(text: string): string {
  // Strip markup first: decoding an escaped "<" would turn real text into a tag.
  return decodeHTML(text.replace(CUE_TAG_PATTERN, ""))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

function readCueText(cue: TextTrackCue): string {
  return "text" in cue && typeof cue.text === "string" ? cue.text : ""
}

/** Cleans each cue's text and keeps the cues that still have text and a duration, in time order. */
export function toSubtitlesFragments(cues: Iterable<SubtitlesFragment>): SubtitlesFragment[] {
  return Array.from(cues)
    .flatMap(({ text, start, end }) => {
      const cleanText = cleanCueText(text)
      return cleanText && end > start ? [{ text: cleanText, start, end }] : []
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)
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
