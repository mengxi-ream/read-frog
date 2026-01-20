import type { SubtitlesFragment } from '../types'
import type { Config } from '@/types/config/config'
import { sendMessage } from '@/utils/message'

/**
 * Patterns to filter out from subtitles (non-speech annotations)
 */
const NOISE_PATTERNS = [
  /^\[.*\]$/, // [Music], [Applause], [Laughter], etc.
  /^\(.*\)$/, // (Music), (Applause), etc.
  /^♪.*♪$/, // ♪ Music ♪
  /^🎵.*🎵$/, // 🎵 Music 🎵
  /^🎶.*🎶$/, // 🎶 Music 🎶
]

/**
 * Check if text is a noise annotation that should be filtered out
 */
function isNoiseText(text: string): boolean {
  const trimmed = text.trim()
  return NOISE_PATTERNS.some(pattern => pattern.test(trimmed))
}

/**
 * Clean and filter fragments before AI processing
 * - Remove newlines from text
 * - Remove empty fragments
 * - Filter out noise annotations like [Music], [Applause]
 */
export function cleanFragmentsForAi(fragments: SubtitlesFragment[]): SubtitlesFragment[] {
  return fragments
    .map(fragment => ({
      ...fragment,
      // Remove newlines and normalize whitespace
      text: fragment.text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter(fragment =>
      // Remove empty fragments
      fragment.text.length > 0
      // Remove noise annotations
      && !isNoiseText(fragment.text),
    )
}

export function formatFragmentsToJson(fragments: SubtitlesFragment[]): string {
  return JSON.stringify(fragments.map(f => ({
    s: f.start,
    e: f.end,
    t: f.text,
  })))
}

/**
 * Parse simplified VTT content returned from AI to fragments
 * Format:
 * WEBVTT
 *
 * 1000 --> 1500
 * Hello world.
 *
 * 2000 --> 3500
 * This is a sentence.
 */
export function parseSimplifiedVttToFragments(vtt: string): SubtitlesFragment[] {
  const fragments: SubtitlesFragment[] = []
  const lines = vtt.trim().split('\n')

  let i = 0
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++
  }

  while (i < lines.length) {
    const line = lines[i].trim()

    // Match timestamp line: "1000 --> 1500" (milliseconds format)
    const match = line.match(/^(\d+)\s*-->\s*(\d+)$/)
    if (match) {
      const start = Number.parseInt(match[1], 10)
      const end = Number.parseInt(match[2], 10)

      // Collect text lines
      const textLines: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        textLines.push(lines[i].trim())
        i++
      }

      if (textLines.length > 0) {
        fragments.push({
          text: textLines.join('\n'),
          start,
          end,
        })
      }
    }
    else {
      i++
    }
  }

  return fragments
}

/**
 * Perform AI segmentation on a block of subtitle fragments
 */
export async function aiSegmentBlock(
  fragments: SubtitlesFragment[],
  config: Config,
): Promise<SubtitlesFragment[]> {
  if (fragments.length === 0) {
    return fragments
  }

  // Clean fragments before AI processing
  const cleanedFragments = cleanFragmentsForAi(fragments)

  if (cleanedFragments.length === 0) {
    return fragments
  }

  const translateProviderId = config.translate.providerId

  // Format fragments to JSON
  const jsonContent = formatFragmentsToJson(cleanedFragments)

  try {
    // Send to background for AI processing
    const segmentedVtt = await sendMessage('aiSegmentSubtitles', {
      jsonContent,
      providerId: translateProviderId,
    })

    // Parse the simplified VTT result
    const segmentedFragments = parseSimplifiedVttToFragments(segmentedVtt)

    // If parsing failed or returned empty, return original fragments
    if (segmentedFragments.length === 0) {
      return fragments
    }

    return segmentedFragments
  }
  catch (error) {
    // On error, fall back to original fragments
    console.error('AI segmentation failed:', error)
    return fragments
  }
}
