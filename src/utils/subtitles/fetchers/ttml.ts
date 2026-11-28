import type { SubtitlesFragment } from "@/utils/subtitles/types"

const DEFAULT_TICK_RATE = 10_000_000
const CLOCK_TIME_PATTERN = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/
const DIALOGUE_LINE_PATTERN = /^[-‐–—]/
const UNSPACED_LANGUAGE_PATTERN = /^(?:zh|ja|yue)\b/i

interface PositionedCue extends SubtitlesFragment {
  y: number
}

function collectLines(node: Node, lines: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      lines[lines.length - 1] += child.textContent ?? ""
    } else if ((child as Element).localName === "br") {
      lines.push("")
    } else {
      collectLines(child, lines)
    }
  }
}

function readCueText(paragraph: Element, language: string): string {
  const lines = [""]
  collectLines(paragraph, lines)
  const trimmed = lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean)
  if (trimmed.length > 1 && trimmed.every((line) => DIALOGUE_LINE_PATTERN.test(line))) {
    return trimmed.join("\n")
  }
  return trimmed.join(UNSPACED_LANGUAGE_PATTERN.test(language) ? "" : " ")
}

// Netflix counts in ticks (`1238400000t`), Prime Video in clock time (`00:02:03.840`).
function toMs(value: string | null, tickRate: number): number {
  const clock = value?.match(CLOCK_TIME_PATTERN)
  const seconds = clock
    ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
    : Number.parseInt(value ?? "", 10) / tickRate
  return Math.round(seconds * 1000)
}

export function parseTtml(xml: string): {
  language: string
  fragments: SubtitlesFragment[]
} {
  const doc = new DOMParser().parseFromString(xml, "text/xml")
  const root = doc.documentElement
  if (root?.localName !== "tt") {
    return { language: "", fragments: [] }
  }

  const language = root.getAttribute("xml:lang") ?? ""
  const tickRate = Number(root.getAttribute("ttp:tickRate")) || DEFAULT_TICK_RATE
  const regionY = new Map(
    Array.from(doc.getElementsByTagNameNS("*", "region"), (region) => [
      region.getAttribute("xml:id"),
      Number.parseFloat(region.getAttribute("tts:origin")?.split(/\s+/)[1] ?? "") || 0,
    ]),
  )

  const byTime = new Map<string, PositionedCue[]>()
  for (const paragraph of Array.from(doc.getElementsByTagNameNS("*", "p"))) {
    const start = toMs(paragraph.getAttribute("begin"), tickRate)
    const end = toMs(paragraph.getAttribute("end"), tickRate)
    const text = readCueText(paragraph, language)
    if (!(end > start) || !text) continue
    const y = regionY.get(paragraph.getAttribute("region")) ?? Number.POSITIVE_INFINITY
    const key = `${start}:${end}`
    byTime.set(key, [...(byTime.get(key) ?? []), { text, start, end, y }])
  }

  const fragments = Array.from(byTime.values(), (cues) => ({
    text: cues
      .sort((a, b) => a.y - b.y)
      .map((cue) => cue.text)
      .join("\n"),
    start: cues[0]!.start,
    end: cues[0]!.end,
  })).sort((a, b) => a.start - b.start || a.end - b.end)

  return { language, fragments }
}
