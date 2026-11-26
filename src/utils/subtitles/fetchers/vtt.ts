import type { SubtitlesFragment } from "@/utils/subtitles/types"

const CUE_TIMING_PATTERN = /^((?:\d+:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}\.\d{3})/

function parseTimestamp(timestamp: string): number {
  const [seconds = 0, minutes = 0, hours = 0] = timestamp.split(":").reverse().map(Number)
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000)
}

/** Reads a WebVTT file's cues in milliseconds; blocks without cue timing are skipped. */
export function parseWebVtt(vtt: string): SubtitlesFragment[] {
  return vtt
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n[ \t]*\n/)
    .flatMap((block) => {
      const lines = block.split("\n")
      const timingIndex = lines.findIndex((line) => CUE_TIMING_PATTERN.test(line))
      const [, start, end] = lines[timingIndex]?.match(CUE_TIMING_PATTERN) || []
      if (!start || !end) return []

      return [
        {
          text: lines.slice(timingIndex + 1).join("\n"),
          start: parseTimestamp(start),
          end: parseTimestamp(end),
        },
      ]
    })
}
