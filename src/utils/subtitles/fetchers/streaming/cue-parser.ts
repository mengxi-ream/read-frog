import type { SubtitlesFragment } from "@/utils/subtitles/types"

// Shared WebVTT / TTML parsing + official-track alignment for streaming subtitle
// adapters (Netflix, HBO Max, ...). Extracted from the Netflix fetcher so every
// adapter reuses the same battle-tested parsers.

export function parseSubtitleText(text: string, offsetMs = 0): SubtitlesFragment[] {
  const trimmed = text.trim()
  if (trimmed.includes("-->"))
    return parseWebVtt(trimmed, offsetMs)
  if (/<(?:tt|timedtext|p)(?:\s|>)/i.test(trimmed))
    return parseTtml(trimmed, offsetMs)
  return []
}

function parseWebVtt(text: string, offsetMs: number): SubtitlesFragment[] {
  const lines = text.replace(/\r/g, "").split("\n")
  const fragments: SubtitlesFragment[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.includes("-->"))
      continue
    const [startText, endAndSettings] = line.split("-->")
    const start = parseTime(startText.trim())
    const end = parseTime(endAndSettings.trim().split(/\s+/)[0])
    const textLines: string[] = []
    while (i + 1 < lines.length && lines[i + 1].trim() !== "")
      textLines.push(lines[++i])
    if (start !== null && end !== null && end > start) {
      const cueText = cleanSubtitleText(textLines.join("\n"))
      if (cueText)
        fragments.push({ text: cueText, start: start + offsetMs, end: end + offsetMs })
    }
  }
  return fragments
}

function parseTtml(text: string, offsetMs: number): SubtitlesFragment[] {
  const doc = new DOMParser().parseFromString(text, "text/xml")
  const tickRateText = doc.documentElement.getAttribute("ttp:tickRate") ?? doc.documentElement.getAttribute("tickRate")
  const tickRate = tickRateText ? Number.parseFloat(tickRateText) : undefined
  return [...doc.querySelectorAll("p")].map((node): SubtitlesFragment | null => {
    const start = parseTime(node.getAttribute("begin") ?? node.getAttribute("t"), tickRate)
    const explicitEnd = parseTime(node.getAttribute("end"), tickRate)
    const duration = parseTime(node.getAttribute("dur") ?? node.getAttribute("d"), tickRate)
    const end = explicitEnd ?? (start !== null && duration !== null ? start + duration : null)
    const cueText = cleanSubtitleText(node.textContent ?? "")
    return start !== null && end !== null && end > start && cueText ? { text: cueText, start: start + offsetMs, end: end + offsetMs } : null
  }).filter((fragment): fragment is SubtitlesFragment => fragment !== null)
}

function parseTime(value: string | null | undefined, tickRate?: number): number | null {
  if (!value)
    return null
  const text = value.trim().replace(",", ".")
  if (/^\d+(?:\.\d+)?t$/.test(text) && tickRate)
    return (Number.parseFloat(text.slice(0, -1)) / tickRate) * 1000
  if (/^\d+(?:\.\d+)?ms$/.test(text))
    return Number.parseFloat(text) || 0
  if (/^\d+(?:\.\d+)?s$/.test(text))
    return Number.parseFloat(text) * 1000
  const parts = text.split(":")
  if (parts.length < 2 || parts.length > 3)
    return null
  const [hours, minutes, seconds] = parts.length === 3 ? parts : ["0", ...parts]
  return ((Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds)) * 1000
}

export function cleanSubtitleText(text: string): string {
  return text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ").trim()
}

// Align an official source-language track with an official target-language track
// by maximum timeline overlap, producing bilingual fragments.
export function alignOfficialSubtitles(sourceSubtitles: SubtitlesFragment[], targetSubtitles: SubtitlesFragment[]): SubtitlesFragment[] {
  const sourceByTargetIndex = new Map<number, SubtitlesFragment[]>()
  for (const source of sourceSubtitles) {
    let bestTargetIndex = -1
    let bestOverlap = 0
    for (const [targetIndex, target] of targetSubtitles.entries()) {
      const overlap = overlapMs(source, target)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestTargetIndex = targetIndex
      }
    }
    if (bestTargetIndex >= 0)
      sourceByTargetIndex.set(bestTargetIndex, [...(sourceByTargetIndex.get(bestTargetIndex) ?? []), source])
  }

  return targetSubtitles.map((target, targetIndex): SubtitlesFragment | null => {
    const text = (sourceByTargetIndex.get(targetIndex) ?? [])
      .map(source => source.text)
      .filter((text, index, texts) => text && text !== texts[index - 1])
      .join("\n")
    return text ? { text, translation: target.text, start: target.start, end: target.end } : null
  }).filter((fragment): fragment is SubtitlesFragment => fragment !== null)
}

function overlapMs(a: SubtitlesFragment, b: SubtitlesFragment): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
}
