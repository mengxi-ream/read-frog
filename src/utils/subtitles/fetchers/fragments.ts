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

/** Cleans each cue's text and keeps the cues that still have text and a duration, in time order. */
export function toSubtitlesFragments(cues: readonly SubtitlesFragment[]): SubtitlesFragment[] {
  return cues
    .flatMap(({ text, start, end }) => {
      const cleanText = cleanCueText(text)
      return cleanText && end > start ? [{ text: cleanText, start, end }] : []
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)
}
