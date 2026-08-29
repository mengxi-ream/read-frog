import type { SubtitlesFragment } from "./types"

export interface TranscriptLine {
  start: number
  end: number
  text: string
  translation?: string
}

/**
 * The source track is the skeleton: it exists whether or not translation is
 * running, and it is the one the player re-segments. Translations are matched
 * on `start`, which is already how the coordinator identifies a cue.
 */
export function buildTranscript(
  source: SubtitlesFragment[],
  translated: SubtitlesFragment[],
): TranscriptLine[] {
  const translationByStart = new Map(
    translated.filter((cue) => cue.translation).map((cue) => [cue.start, cue.translation!]),
  )

  return source.map((cue) => {
    const translation = translationByStart.get(cue.start)
    return {
      start: cue.start,
      end: cue.end,
      text: cue.text,
      // Passthrough and the error fallback copy the source into `translation`,
      // which would print the line twice.
      translation: translation === cue.text ? undefined : translation,
    }
  })
}

/**
 * Cues do not tile the timeline — a pause between them leaves a gap, and the
 * playhead sits before the first cue at the start. Returning -1 rather than
 * clamping keeps "nothing is being said" distinct from "the first line is".
 */
export function findActiveLine(lines: TranscriptLine[], timeMs: number): number {
  return lines.findIndex((line) => line.start <= timeMs && line.end > timeMs)
}
