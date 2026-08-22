import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { decodeHTML } from "entities"

const TIMING_SEPARATOR = /\s+-->\s+/
const WEBVTT_TIMESTAMP_PATTERN = /^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})$/
const TIMESTAMP_MAP_PATTERN = /X-TIMESTAMP-MAP\s*[=:]\s*LOCAL:\s*([\d:.,]+)\s*,\s*MPEGTS:\s*(\d+)/i
const MPEGTS_CLOCK_HZ = 90_000

function parseWebVttTimestamp(timestamp: string): number | null {
  const match = timestamp.trim().match(WEBVTT_TIMESTAMP_PATTERN)
  if (!match) {
    return null
  }

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const milliseconds = Number(match[4])

  if (![hours, minutes, seconds, milliseconds].every(Number.isFinite)) {
    return null
  }

  return (hours * 60 * 60 + minutes * 60 + seconds) * 1000 + milliseconds
}

export function getWebVttTimestampMapOffsetMs(vttText: string): number | null {
  const match = vttText.match(TIMESTAMP_MAP_PATTERN)
  if (!match) {
    return null
  }

  const [, localRaw, mpegtsRaw] = match
  if (!localRaw || !mpegtsRaw) {
    return null
  }

  const local = parseWebVttTimestamp(localRaw)
  const mpegts = Number(mpegtsRaw)

  if (local === null || !Number.isFinite(mpegts)) {
    return null
  }

  return (mpegts / MPEGTS_CLOCK_HZ) * 1000 - local
}

export function cleanWebVttCueText(text: string): string {
  return decodeHTML(text)
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim()
}

function shouldSkipBlock(line: string): boolean {
  return (
    line.startsWith("WEBVTT") ||
    line.startsWith("NOTE") ||
    line.startsWith("STYLE") ||
    line.startsWith("REGION")
  )
}

export function parseWebVttSubtitles(vttText: string): SubtitlesFragment[] {
  const lines = vttText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")

  const lineAt = (position: number): string => lines[position] ?? ""
  const fragments: SubtitlesFragment[] = []
  let index = 0

  while (index < lines.length) {
    while (index < lines.length && !lineAt(index).trim()) {
      index++
    }

    if (index >= lines.length) {
      break
    }

    if (shouldSkipBlock(lineAt(index).trim())) {
      index++
      while (index < lines.length && lineAt(index).trim()) {
        index++
      }
      continue
    }

    let timingLine = lineAt(index).trim()
    if (!timingLine.includes("-->")) {
      index++
      if (index >= lines.length) {
        break
      }
      timingLine = lineAt(index).trim()
    }

    if (!timingLine.includes("-->")) {
      while (index < lines.length && lineAt(index).trim()) {
        index++
      }
      continue
    }

    const [startRaw, endAndSettingsRaw] = timingLine.split(TIMING_SEPARATOR)
    const endRaw = endAndSettingsRaw?.trim().split(/\s+/)[0]
    const start = startRaw ? parseWebVttTimestamp(startRaw) : null
    const end = endRaw ? parseWebVttTimestamp(endRaw) : null

    index++
    const textLines: string[] = []
    while (index < lines.length && lineAt(index).trim()) {
      textLines.push(lineAt(index))
      index++
    }

    const text = cleanWebVttCueText(textLines.join("\n"))
    if (start !== null && end !== null && end > start && text) {
      fragments.push({ text, start, end })
    }
  }

  return fragments.sort((a, b) => a.start - b.start || a.end - b.end)
}
