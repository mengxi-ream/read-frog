import type { SubtitlesFragment } from "../types"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { sendMessage } from "@/utils/message"

const NEWLINE_PATTERN = /\n/g
const WHITESPACE_PATTERN = /\s+/g
const VTT_TIMESTAMP_PATTERN = /^(\d+)\s*-->\s*(\d+)$/

/**
 * Hosted `prompt` is capped at 32000 characters by the contract. Held below it
 * so the prompt template and instructions have room, and so a split happens
 * before the server would reject the request outright.
 */
const HOSTED_SEGMENTATION_MAX_PROMPT_CHARS = 28000

export function cleanFragmentsForAi(fragments: SubtitlesFragment[]): SubtitlesFragment[] {
  return fragments
    .map((fragment) => ({
      ...fragment,
      text: fragment.text.replace(NEWLINE_PATTERN, " ").replace(WHITESPACE_PATTERN, " ").trim(),
    }))
    .filter((fragment) => fragment.text.length > 0)
}

export function formatFragmentsToJson(fragments: SubtitlesFragment[]): string {
  return JSON.stringify(
    fragments.map((f) => ({
      s: f.start,
      e: f.end,
      t: f.text,
    })),
  )
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
  while (lineIndex < lines.length && !lines[lineIndex]!.includes("-->")) {
    lineIndex++
  }

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]!.trim()

    // Match timestamp line: "1000 --> 1500" (milliseconds format)
    const match = line.match(VTT_TIMESTAMP_PATTERN)
    if (match) {
      const start = Number.parseInt(match[1]!, 10)
      const end = Number.parseInt(match[2]!, 10)

      // Collect text lines
      const textLines: string[] = []
      lineIndex++
      while (
        lineIndex < lines.length &&
        lines[lineIndex]!.trim() !== "" &&
        !lines[lineIndex]!.includes("-->")
      ) {
        textLines.push(lines[lineIndex]!.trim())
        lineIndex++
      }

      if (textLines.length > 0) {
        fragments.push({
          text: textLines.join("\n"),
          start,
          end,
        })
      }
    } else {
      lineIndex++
    }
  }

  return fragments
}

/**
 * Perform AI segmentation on a block of subtitle fragments.
 *
 * `providerRef` is resolved once per session/run by the caller: segmentation
 * runs per look-ahead block, and a hosted ref costs a hostedAi.status round
 * trip to resolve, so resolving here would pay that per block. Both subtitle
 * routes gate on the same hosted feature, so the session's `videoSubtitles`
 * ref serves segmentation as-is; the wider-budget segmentation route is picked
 * in the background by the message handler.
 */
export async function aiSegmentBlock(
  fragments: SubtitlesFragment[],
  providerRef: PromptableProviderRef,
): Promise<SubtitlesFragment[]> {
  if (fragments.length === 0) {
    return fragments
  }

  const cleanedFragments = cleanFragmentsForAi(fragments)

  if (cleanedFragments.length === 0) {
    return fragments
  }

  const jsonContent = formatFragmentsToJson(cleanedFragments)

  // A hosted prompt is capped server-side, and the live path stays far under it
  // (one look-ahead window), but the download path segments a whole file. Split
  // rather than truncate: dropping the tail of subtitle JSON silently loses
  // cues, which is a correctness bug, not a degraded result. Local providers
  // have no such cap, so they never split.
  if (providerRef.kind === "system" && jsonContent.length > HOSTED_SEGMENTATION_MAX_PROMPT_CHARS) {
    if (cleanedFragments.length < 2) {
      throw new Error("A single subtitle fragment exceeds the hosted segmentation limit")
    }
    const middle = Math.floor(cleanedFragments.length / 2)
    const [head, tail] = await Promise.all([
      aiSegmentBlock(cleanedFragments.slice(0, middle), providerRef),
      aiSegmentBlock(cleanedFragments.slice(middle), providerRef),
    ])
    return [...head, ...tail]
  }

  const segmentedVtt = await sendMessage("aiSegmentSubtitles", {
    jsonContent,
    providerRef,
  })

  const segmentedFragments = parseSimplifiedVttToFragments(segmentedVtt)

  if (segmentedFragments.length === 0) {
    throw new Error("AI segmentation returned empty result")
  }

  return segmentedFragments
}
