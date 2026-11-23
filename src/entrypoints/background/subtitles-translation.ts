import type { SubtitlePromptContext } from "@/types/content"
import { normalizeLanguageConfig } from "@/utils/config/languages"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { cleanText } from "@/utils/content/utils"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { onMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import { canProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { RequestQueue } from "@/utils/request/request-queue"
import { getOrGenerateTranslationContextSummary } from "./translation-context-summary"
import {
  createSubtitlesTranslationQueues,
  getLocalProviderConfig,
  shouldUseBatchQueue,
} from "./translation-queues"

/**
 * Machine translations stand in for lines the AI has not returned yet, one per
 * line as it is about to show: a request every few seconds at most, a few
 * after a seek. Their own queue, as a rate-limit pause on the AI provider's
 * would hold them too, and a late one is worthless: one attempt, no retries.
 */
function createMachinePlaceholderQueue() {
  return new RequestQueue({
    rate: 5,
    capacity: 10,
    timeoutMs: 5_000,
    maxRetries: 0,
    baseRetryDelayMs: 0,
    retryPolicy: { decide: () => ({ action: "fail" }) },
  })
}

/** Register handlers synchronously while queue initialization runs in the background. */
export function setupSubtitlesTranslationHandlers(): void {
  const queuesPromise = createSubtitlesTranslationQueues()
  const machineQueue = createMachinePlaceholderQueue()

  onMessage("enqueueSubtitlesTranslateRequest", async (message) => {
    const { requestQueue, batchQueue } = await queuesPromise
    const {
      data: {
        text,
        langConfig: sentLangConfig,
        providerRef,
        scheduleAt,
        hash,
        webTitle,
        webDescription,
        summary,
        glossaryTerms,
        glossaryRevision,
      },
    } = message
    const langConfig = normalizeLanguageConfig(sentLangConfig)

    if (hash) {
      const cached = await db.translationCache.get(hash)
      if (cached) {
        return cached.translation
      }
    }

    let result: string
    const context: SubtitlePromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      videoSummary: normalizePromptContextValue(summary),
    }

    if (shouldUseBatchQueue(providerRef)) {
      const data = {
        text,
        langConfig,
        provider: providerRef,
        hostedFeature: "videoSubtitles" as const,
        hash,
        scheduleAt,
        context,
        // Kept off `context`, which is part of the batch key — see
        // `mergeBatchGlossaryTerms`.
        glossaryTerms,
        glossaryRevision,
      }
      result = await batchQueue.enqueue(data)
    } else {
      // Unreachable for system refs — shouldUseBatchQueue always batches them —
      // but it must fail loudly rather than silently mistranslate if that ever
      // changes, since executeTranslate only understands a local config.
      const localConfig = getLocalProviderConfig(providerRef)
      if (!localConfig) {
        throw new Error("Built-in AI subtitle translation must use the batch queue")
      }
      const thunk = (signal?: AbortSignal) =>
        executeTranslate(text, langConfig, localConfig, getSubtitlesTranslatePrompt, {
          signal,
          glossaryTerms,
        })
      result = await requestQueue.enqueue(thunk, scheduleAt, hash)
    }

    if (result && hash) {
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("translateSubtitleWithMachine", async (message) => {
    const { text, langConfig: sentLangConfig, hash } = message.data
    const cached = await db.translationCache.get(hash)
    if (cached) {
      return cached.translation
    }

    const langConfig = normalizeLanguageConfig(sentLangConfig)
    const result = await machineQueue.enqueue(
      (signal) =>
        executeTranslate(
          text,
          langConfig,
          DEFAULT_PROVIDER_CONFIG["microsoft-translate"],
          getSubtitlesTranslatePrompt,
          { signal },
        ),
      Date.now(),
      hash,
    )

    if (result) {
      await db.translationCache.put({ key: hash, translation: result, createdAt: new Date() })
    }
    return result
  })

  onMessage("getSubtitlesSummary", async (message) => {
    const { requestQueue } = await queuesPromise
    const { videoTitle, subtitlesContext, providerRef } = message.data

    // Guarded on both sides: the content script should not send this for a
    // provider with no model to prompt, and the queue must not admit a task
    // that can only throw if it does.
    if (!videoTitle || !subtitlesContext || !canProviderRefGenerateText(providerRef)) {
      return null
    }

    return await getOrGenerateTranslationContextSummary({
      title: videoTitle,
      textContent: subtitlesContext,
      providerRef,
      hostedFeature: "videoSubtitles",
      // Deliberately without the title, matching the previous key: a video's
      // transcript identifies it, and including a title that players mutate
      // would miss the cache on every re-render.
      cacheKeyParts: [Sha256Hex(cleanText(subtitlesContext))],
      requestQueue,
    })
  })
}
