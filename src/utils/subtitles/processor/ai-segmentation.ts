import type { SubtitlesFragment } from "../types"
import type { Config } from "@/types/config/config"
import { sendMessage } from "@/utils/message"

export function cleanFragmentsForAi(fragments: SubtitlesFragment[]): SubtitlesFragment[] {
  return fragments
    .map(fragment => ({
      ...fragment,
      text: fragment.text.replace(/\n/g, " ").replace(/\s+/g, " ").trim(),
    }))
    .filter(fragment => fragment.text.length > 0)
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
  const lines = vtt.trim().split("\n")

  let lineIndex = 0
  // Skip WEBVTT header
  while (lineIndex < lines.length && !lines[lineIndex].includes("-->")) {
    lineIndex++
  }

  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim()

    // Match timestamp line: "1000 --> 1500" (milliseconds format)
    const match = line.match(/^(\d+)\s*-->\s*(\d+)$/)
    if (match) {
      const start = Number.parseInt(match[1], 10)
      const end = Number.parseInt(match[2], 10)

      // Collect text lines
      const textLines: string[] = []
      lineIndex++
      while (lineIndex < lines.length && lines[lineIndex].trim() !== "" && !lines[lineIndex].includes("-->")) {
        textLines.push(lines[lineIndex].trim())
        lineIndex++
      }

      if (textLines.length > 0) {
        fragments.push({
          text: textLines.join("\n"),
          start,
          end,
        })
      }
    }
    else {
      lineIndex++
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

  const cleanedFragments = cleanFragmentsForAi(fragments)

  if (cleanedFragments.length === 0) {
    return fragments
  }

  const jsonContent = formatFragmentsToJson(cleanedFragments)

  const segmentedVtt = await sendMessage("aiSegmentSubtitles", {
    jsonContent,
    providerId: config.videoSubtitles.providerId,
  })

  const segmentedFragments = parseSimplifiedVttToFragments(segmentedVtt)

  if (segmentedFragments.length === 0) {
    throw new Error("AI segmentation returned empty result")
  }

  return segmentedFragments
}
