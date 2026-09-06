import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { onMessage } from "@/utils/message"
import { getProviderCacheIdentity } from "@/utils/providers/provider-ref"

/**
 * Bumped whenever the summary prompt changes: the cache key has to move with
 * it or every user keeps being served answers from the old wording.
 */
const VIDEO_SUMMARY_PROMPT_VERSION = "1"

function videoSummaryCacheKey(args: {
  transcript: string
  targetLanguage: string
  providerRef: PromptableProviderRef
}): string {
  return Sha256Hex(
    Sha256Hex(args.transcript),
    args.targetLanguage,
    VIDEO_SUMMARY_PROMPT_VERSION,
    getProviderCacheIdentity(args.providerRef),
  )
}

export function setupVideoSummaryHandlers(): void {
  onMessage("getCachedVideoSummary", async (message) => {
    const { transcript, targetLanguage, providerRef } = message.data
    if (!transcript) {
      return null
    }

    const cached = await db.articleSummaryCache.get(
      videoSummaryCacheKey({ transcript, targetLanguage, providerRef }),
    )
    return cached?.summary ?? null
  })

  onMessage("saveVideoSummary", async (message) => {
    const { transcript, targetLanguage, providerRef, summary } = message.data
    const trimmed = summary.trim()
    if (!transcript || !trimmed) {
      return
    }

    await db.articleSummaryCache.put({
      key: videoSummaryCacheKey({ transcript, targetLanguage, providerRef }),
      summary: trimmed,
      createdAt: new Date(),
    })
  })
}
