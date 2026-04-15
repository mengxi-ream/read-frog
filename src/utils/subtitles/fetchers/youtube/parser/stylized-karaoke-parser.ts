import type { SubtitlesFragment } from "../../../types"
import type { YoutubeTimedText } from "../types"

const ZERO_WIDTH_SPACE_PATTERN = /\u200B/g
const WHITESPACE_PATTERN = /\s+/g
const SLASH_PATTERN = /\//g
const FAMILY_GAP_MS = 1_200
const MIN_PREFIX_LENGTH = 10

interface TrackStats {
  trackId: number
  eventCount: number
  markerCount: number
  textLength: number
}

interface SentenceFamily {
  text: string
  normalized: string
  start: number
  end: number
  lastStart: number
}

function pushFragment(result: SubtitlesFragment[], fragment: SubtitlesFragment) {
  const last = result.at(-1)
  if (last && last.end > fragment.start) {
    last.end = fragment.start
  }
  result.push(fragment)
}

function getEventText(event: YoutubeTimedText): string {
  return (event.segs ?? [])
    .map(seg => seg.utf8 || "")
    .join("")
}

function cleanStylizedText(text: string): string {
  return text
    .replace(ZERO_WIDTH_SPACE_PATTERN, "")
    .replace(SLASH_PATTERN, "")
    .replace(WHITESPACE_PATTERN, " ")
    .trim()
}

function buildSentenceKey(text: string): string {
  return text.toLowerCase()
}

function selectMainTrack(events: YoutubeTimedText[]): number | null {
  const statsByTrack = new Map<number, TrackStats>()

  for (const event of events) {
    if (event.wpWinPosId === undefined)
      continue

    const rawText = getEventText(event)
    const cleanedText = cleanStylizedText(rawText)
    if (!cleanedText)
      continue

    const current = statsByTrack.get(event.wpWinPosId) ?? {
      trackId: event.wpWinPosId,
      eventCount: 0,
      markerCount: 0,
      textLength: 0,
    }

    current.eventCount += 1
    current.textLength += cleanedText.length
    if (rawText.includes("/") || rawText.includes("\u200B")) {
      current.markerCount += 1
    }

    statsByTrack.set(event.wpWinPosId, current)
  }

  const tracks = [...statsByTrack.values()]
  if (tracks.length === 0)
    return null

  tracks.sort((left, right) => {
    if (right.eventCount !== left.eventCount)
      return right.eventCount - left.eventCount
    if (right.markerCount !== left.markerCount)
      return right.markerCount - left.markerCount
    if (right.textLength !== left.textLength)
      return right.textLength - left.textLength
    return right.trackId - left.trackId
  })

  return tracks[0].trackId
}

function isSameSentenceFamily(current: SentenceFamily, text: string, start: number): boolean {
  if (start - current.lastStart > FAMILY_GAP_MS)
    return false

  const nextNormalized = buildSentenceKey(text)
  if (nextNormalized === current.normalized)
    return true

  const shorter = current.normalized.length <= nextNormalized.length ? current.normalized : nextNormalized
  const longer = current.normalized.length <= nextNormalized.length ? nextNormalized : current.normalized

  return shorter.length >= MIN_PREFIX_LENGTH && longer.startsWith(shorter)
}

function shouldReplaceFamilyText(currentText: string, nextText: string): boolean {
  return nextText.length > currentText.length
}

export function parseStylizedKaraokeSubtitles(events: YoutubeTimedText[]): SubtitlesFragment[] {
  const mainTrackId = selectMainTrack(events)
  if (mainTrackId === null)
    return []

  const result: SubtitlesFragment[] = []
  let currentFamily: SentenceFamily | null = null

  for (const event of events) {
    if (event.wpWinPosId !== mainTrackId)
      continue

    const text = cleanStylizedText(getEventText(event))
    if (!text)
      continue

    const fragmentEnd = event.tStartMs + (event.dDurationMs ?? 0)

    if (!currentFamily) {
      currentFamily = {
        text,
        normalized: buildSentenceKey(text),
        start: event.tStartMs,
        end: fragmentEnd,
        lastStart: event.tStartMs,
      }
      continue
    }

    if (isSameSentenceFamily(currentFamily, text, event.tStartMs)) {
      currentFamily.end = fragmentEnd
      currentFamily.lastStart = event.tStartMs

      if (shouldReplaceFamilyText(currentFamily.text, text)) {
        currentFamily.text = text
        currentFamily.normalized = buildSentenceKey(text)
      }
      continue
    }

    pushFragment(result, {
      text: currentFamily.text,
      start: currentFamily.start,
      end: currentFamily.end,
    })

    currentFamily = {
      text,
      normalized: buildSentenceKey(text),
      start: event.tStartMs,
      end: fragmentEnd,
      lastStart: event.tStartMs,
    }
  }

  if (currentFamily) {
    pushFragment(result, {
      text: currentFamily.text,
      start: currentFamily.start,
      end: currentFamily.end,
    })
  }

  return result
}
