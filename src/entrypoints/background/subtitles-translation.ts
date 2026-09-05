import type { SubtitlePromptContext } from "@/types/content"
import { cleanText } from "@/utils/content/utils"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { onMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import { canProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { getOrGenerateTranslationContextSummary } from "./translation-context-summary"
import {
  createSubtitlesTranslationQueues,
  getLocalProviderConfig,
  shouldUseBatchQueue,
} from "./translation-queues"

/** Register handlers synchronously while queue initialization runs in the background. */
export function setupSubtitlesTranslationHandlers(): void {
  const queuesPromise = createSubtitlesTranslationQueues()

  onMessage("enqueueSubtitlesTranslateRequest", async (message) => {
    const { requestQueue, batchQueue } = await queuesPromise
    const {
      data: { text, langConfig, providerRef, scheduleAt, hash, webTitle, webDescription, summary },
    } = message

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
        hash,
        scheduleAt,
        context,
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
        executeTranslate(text, langConfig, localConfig, getSubtitlesTranslatePrompt, { signal })
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
