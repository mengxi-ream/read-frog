import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SubtitlesFragment } from "../types"
import type { SubtitlesFetcher } from "./types"
import { getLocalConfig } from "@/utils/config/storage"
import {
  STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE,
  STREAMING_SUBTITLE_CAPTURED_TYPE,
  STREAMING_SUBTITLE_TRACKS_TYPE,
  STREAMING_SUBTITLE_WAIT_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { backgroundFetch } from "@/utils/content-script/background-fetch-client"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"

interface StreamingTrack {
  url: string
  language?: string
  label?: string
  kind?: string
}

const tracksByUrl = new Map<string, StreamingTrack>()
const capturesByUrl = new Map<string, string>()
const trackWaiters = new Set<() => void>()

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin)
      return
    if (event.data?.type === STREAMING_SUBTITLE_TRACKS_TYPE && Array.isArray(event.data.tracks)) {
      event.data.tracks.forEach((track: StreamingTrack) => tracksByUrl.set(track.url, track))
      trackWaiters.forEach(resolve => resolve())
      trackWaiters.clear()
    }
    if (event.data?.type === STREAMING_SUBTITLE_CAPTURED_TYPE && event.data.url && event.data.text)
      capturesByUrl.set(event.data.url, event.data.text)
  })
}

export class NetflixSubtitlesFetcher implements SubtitlesFetcher {
  private sourceLanguage = ""
  private subtitles: SubtitlesFragment[] = []

  async fetch(): Promise<SubtitlesFragment[]> {
    const tracks = await this.waitForTracks()
    const config = await getLocalConfig()
    const sourceTrack = selectSourceTrack(tracks)
    const targetTrack = config?.language.targetCode ? selectTargetTrack(tracks, config.language.targetCode) : null
    if (!sourceTrack || !targetTrack || sourceTrack.url === targetTrack.url)
      return []

    const [sourceText, targetText] = await Promise.all([
      this.resolveTrackText(sourceTrack),
      this.resolveTrackText(targetTrack),
    ])
    this.subtitles = alignOfficialSubtitles(parseSubtitleText(sourceText), parseSubtitleText(targetText))
    this.sourceLanguage = sourceTrack.language ?? ""
    return this.subtitles
  }

  async hasAvailableSubtitles(): Promise<boolean> {
    const tracks = await this.waitForTracks()
    const config = await getLocalConfig()
    return Boolean(selectSourceTrack(tracks) && config?.language.targetCode && selectTargetTrack(tracks, config.language.targetCode))
  }

  shouldUseSameTrack(): Promise<boolean> {
    return Promise.resolve(this.subtitles.length > 0)
  }

  cleanup() {}

  getSourceLanguage() {
    return this.sourceLanguage
  }

  isPreSegmented() {
    return true
  }

  private async waitForTracks(): Promise<StreamingTrack[]> {
    window.postMessage({ type: STREAMING_ENSURE_NATIVE_SUBTITLES_TYPE }, window.location.origin)
    if (tracksByUrl.size > 0)
      return [...tracksByUrl.values()]

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, STREAMING_SUBTITLE_WAIT_TIMEOUT_MS)
      trackWaiters.add(() => {
        clearTimeout(timer)
        resolve()
      })
    })
    return [...tracksByUrl.values()]
  }

  private async resolveTrackText(track: StreamingTrack): Promise<string> {
    const captured = capturesByUrl.get(track.url)
    if (captured)
      return captured

    const response = await backgroundFetch(track.url, undefined, { credentials: "include" })
    if (!response.ok)
      throw new Error(`Failed to fetch Netflix subtitle track: ${response.status}`)
    return response.text()
  }
}

function selectSourceTrack(tracks: StreamingTrack[]): StreamingTrack | null {
  const englishTracks = tracks.filter(track => /^en\b/i.test(track.language ?? "") || /\bEnglish\b|英語/i.test(track.label ?? ""))
  return englishTracks.find(track => /assistive|caption|closed\s*caption|\bcc\b/i.test(`${track.kind ?? ""} ${track.label ?? ""}`))
    ?? englishTracks[0]
    ?? null
}

function selectTargetTrack(tracks: StreamingTrack[], targetCode: LangCodeISO6393): StreamingTrack | null {
  return tracks.find((track) => {
    const resolved = resolveLanguageCodeFromLocale(track.language ?? track.label ?? "")
    return resolved === targetCode || (isChineseCode(targetCode) && /zh|中文|Chinese/i.test(`${track.language ?? ""} ${track.label ?? ""}`))
  }) ?? null
}

function isChineseCode(code: LangCodeISO6393): boolean {
  return code === "cmn" || code === "cmn-Hant" || code === "yue"
}

function alignOfficialSubtitles(sourceSubtitles: SubtitlesFragment[], targetSubtitles: SubtitlesFragment[]): SubtitlesFragment[] {
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

function parseSubtitleText(text: string): SubtitlesFragment[] {
  const trimmed = text.trim()
  if (trimmed.includes("-->"))
    return parseWebVtt(trimmed)
  if (/<(?:tt|timedtext|p)(?:\s|>)/i.test(trimmed))
    return parseTtml(trimmed)
  return []
}

function parseWebVtt(text: string): SubtitlesFragment[] {
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
        fragments.push({ text: cueText, start, end })
    }
  }
  return fragments
}

function parseTtml(text: string): SubtitlesFragment[] {
  const doc = new DOMParser().parseFromString(text, "text/xml")
  const tickRateText = doc.documentElement.getAttribute("ttp:tickRate") ?? doc.documentElement.getAttribute("tickRate")
  const tickRate = tickRateText ? Number.parseFloat(tickRateText) : undefined
  return [...doc.querySelectorAll("p")].map((node): SubtitlesFragment | null => {
    const start = parseTime(node.getAttribute("begin") ?? node.getAttribute("t"), tickRate)
    const explicitEnd = parseTime(node.getAttribute("end"), tickRate)
    const duration = parseTime(node.getAttribute("dur") ?? node.getAttribute("d"), tickRate)
    const end = explicitEnd ?? (start !== null && duration !== null ? start + duration : null)
    const cueText = cleanSubtitleText(node.textContent ?? "")
    return start !== null && end !== null && end > start && cueText ? { text: cueText, start, end } : null
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

function cleanSubtitleText(text: string): string {
  return text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ").trim()
}
