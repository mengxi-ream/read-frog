import type { SubtitlesFragment } from '../../../types'
import type { YoutubeTimedText } from '../types'

/**
 * Parse standard format subtitles
 */
export function parseStandardSubtitles(events: YoutubeTimedText[] = []): SubtitlesFragment[] {
  const segments: SubtitlesFragment[] = []
  let buffer: SubtitlesFragment | null = null

  events.forEach(({ segs = [], tStartMs = 0, dDurationMs = 0 }) => {
    segs.forEach(({ utf8 = '', tOffsetMs = 0 }, segIndex) => {
      const text = utf8.trim().replace(/\s+/g, ' ')
      const start = tStartMs + tOffsetMs

      if (buffer) {
        if (!buffer.end || buffer.end > start) {
          buffer.end = start
        }
        segments.push(buffer)
        buffer = null
      }

      buffer = {
        text,
        start,
        end: 0,
      }

      if (segIndex === segs.length - 1) {
        buffer.end = tStartMs + dDurationMs
      }
    })
  })

  if (buffer) {
    segments.push(buffer)
  }
  return segments
}
