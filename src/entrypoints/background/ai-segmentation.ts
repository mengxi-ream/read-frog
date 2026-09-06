import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { logger } from "@/utils/logger"
import { getSubtitlesSegmentationPrompt } from "@/utils/prompts/subtitles-segmentation"
import {
  canProviderRefGenerateText,
  getProviderCacheIdentity,
} from "@/utils/providers/provider-ref"
import { parseSimplifiedVttToFragments } from "@/utils/subtitles/processor/ai-segmentation"
import { generateTextForProviderRef } from "./background-stream"

const VTT_CODE_BLOCK_RE = /```vtt\n?/g
const CODE_BLOCK_RE = /```\n?/g
const THINK_TAG_RE = /<\/think>([\s\S]*)/

interface AiSegmentSubtitlesData {
  jsonContent: string
  providerRef: PromptableProviderRef
}

/**
 * Clean VTT response from AI (remove markdown code blocks, ensure WEBVTT header)
 */
function cleanVttResponse(text: string): string {
  let cleaned = text.trim()

  // Remove markdown code blocks
  cleaned = cleaned.replace(VTT_CODE_BLOCK_RE, "").replace(CODE_BLOCK_RE, "")

  // Handle thinking model output (strip <think> tags)
  const [, afterThink = cleaned] = cleaned.match(THINK_TAG_RE) || []
  cleaned = afterThink.trim()

  // Ensure starts with WEBVTT
  if (!cleaned.toUpperCase().startsWith("WEBVTT")) {
    cleaned = `WEBVTT\n\n${cleaned}`
  }

  return cleaned
}

/**
 * Run AI segmentation on JSON subtitle content
 */
export async function runAiSegmentSubtitles(data: AiSegmentSubtitlesData): Promise<string> {
  const { jsonContent, providerRef } = data

  if (!jsonContent) {
    throw new Error("jsonContent is required for AI segmentation")
  }

  // The payload type forces senders to narrow, but the wire is a trust
  // boundary (a pre-update content script can send a translate-only ref).
  // Refuse before the cache reads: the ref could only throw deeper anyway,
  // after a doomed generation attempt.
  if (!canProviderRefGenerateText(providerRef)) {
    throw new Error(`Provider cannot generate text; AI segmentation needs a promptable model`)
  }

  // The ref is resolved on the content side, where a session already holds one:
  // resolving here would cost a hostedAi.status round trip per block.
  const cacheKey = Sha256Hex(Sha256Hex(jsonContent), getProviderCacheIdentity(providerRef))
  const cached = await db.aiSegmentationCache.get(cacheKey)
  if (cached) {
    if (parseSimplifiedVttToFragments(cached.result).length > 0) {
      logger.info("[Background] AI subtitle segmentation cache hit")
      return cached.result
    }
    // Entry written before results were parse-checked; drop it and regenerate
    // instead of serving the same unusable VTT on every attempt.
    await db.aiSegmentationCache.delete(cacheKey)
  }

  const { systemPrompt, prompt } = getSubtitlesSegmentationPrompt(jsonContent)

  try {
    const segmentedVtt = await generateTextForProviderRef({
      providerRef,
      // Its own route, not videoSubtitles: segmentation emits a whole WebVTT
      // block and needs the wider output budget that route reserves.
      hostedFeature: "videoSubtitlesSegmentation",
      instructions: systemPrompt,
      prompt,
      requestId: getRandomUUID(),
    })

    const result = cleanVttResponse(segmentedVtt)

    // Parse-check before caching: a cached result that yields no cues would be
    // served on every later attempt for this chunk, pinning the failure until
    // the provider's cache identity changes.
    if (parseSimplifiedVttToFragments(result).length === 0) {
      throw new Error("AI segmentation returned an unparseable result")
    }

    await db.aiSegmentationCache.put({
      key: cacheKey,
      result,
      createdAt: new Date(),
    })

    logger.info("[Background] AI subtitle segmentation completed")
    return result
  } catch (error) {
    logger.error("[Background] AI subtitle segmentation failed:", error)
    throw error
  }
}
