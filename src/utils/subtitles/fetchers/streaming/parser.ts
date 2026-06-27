import type { SubtitlesFragment } from "../../types"
import { decodeHTML } from "entities"

const CUE_TIME_SEPARATOR = "-->"
const TAG_PATTERN = /<[^>]+>/g
const BR_PATTERN = /<br\s*\/?>/gi

export function parseStreamingSubtitles(text: string): SubtitlesFragment[] {
  const trimmed = text.trim()
  if (!trimmed)
    return []

  if (trimmed.includes(CUE_TIME_SEPARATOR))
    return parseCueText(trimmed)

  if (/<(?:tt|timedtext|p)(?:\s|>)/i.test(trimmed))
    return parseTimedTextXml(trimmed)

  return []
}

function parseCueText(text: string): SubtitlesFragment[] {
  const lines = text.replace(/\r/g, "").split("\n")
  const fragments: SubtitlesFragment[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line === "WEBVTT" || line.startsWith("NOTE") || line.startsWith("STYLE") || /^\d+$/.test(line))
      continue

    if (!line.includes(CUE_TIME_SEPARATOR))
      continue

    const [startText, endAndSettings] = line.split(CUE_TIME_SEPARATOR)
    const endText = endAndSettings.trim().split(/\s+/)[0]
    const start = parseTimeExpression(startText.trim())
    const end = parseTimeExpression(endText)

    if (start === null || end === null || end <= start)
      continue

    const textLines: string[] = []
    while (i + 1 < lines.length && lines[i + 1].trim() !== "") {
      i += 1
      textLines.push(lines[i])
    }

    const cueText = cleanSubtitleText(textLines.join("\n"))
    if (cueText)
      fragments.push({ text: cueText, start, end })
  }

  return fragments
}

function parseTimedTextXml(text: string): SubtitlesFragment[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, "text/xml")
  const parseError = doc.querySelector("parsererror")
  if (parseError)
    return []

  return [...doc.querySelectorAll("p")]
    .map((node): SubtitlesFragment | null => {
      const start = parseTimeExpression(node.getAttribute("begin") ?? node.getAttribute("t"))
      const explicitEnd = parseTimeExpression(node.getAttribute("end"))
      const duration = parseTimeExpression(node.getAttribute("dur") ?? node.getAttribute("d"))
      const end = explicitEnd ?? (start !== null && duration !== null ? start + duration : null)

      if (start === null || end === null || end <= start)
        return null

      const cueText = cleanSubtitleText(readNodeText(node))
      return cueText ? { text: cueText, start, end } : null
    })
    .filter((fragment): fragment is SubtitlesFragment => fragment !== null)
}

function readNodeText(node: Element): string {
  return [...node.childNodes]
    .map((child) => {
      if (child.nodeType === 3)
        return child.textContent ?? ""

      if (child.nodeType !== 1)
        return ""

      const element = child as Element
      if (element.tagName.toLowerCase() === "br")
        return "\n"

      return readNodeText(element)
    })
    .join("")
}

function cleanSubtitleText(text: string): string {
  return decodeHTML(
    text
      .replace(BR_PATTERN, "\n")
      .replace(TAG_PATTERN, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim(),
  )
}

export function parseTimeExpression(value: string | null | undefined): number | null {
  if (!value)
    return null

  const text = value.trim().replace(",", ".")

  if (/^\d+(?:\.\d+)?ms$/.test(text))
    return Number.parseFloat(text) || 0

  if (/^\d+(?:\.\d+)?s$/.test(text))
    return Number.parseFloat(text) * 1000

  if (/^\d+$/.test(text))
    return Number.parseInt(text, 10)

  const parts = text.split(":")
  if (parts.length < 2 || parts.length > 3)
    return null

  const seconds = Number.parseFloat(parts.at(-1)!)
  const minutes = Number.parseInt(parts.at(-2)!, 10)
  const hours = parts.length === 3 ? Number.parseInt(parts[0], 10) : 0

  if (![seconds, minutes, hours].every(Number.isFinite))
    return null

  return ((hours * 60 * 60) + (minutes * 60) + seconds) * 1000
}
