import type { WebPagePromptContext } from "@/types/content"
import { browser } from "#imports"
import { isNoTranslationSentinel } from "@/utils/constants/prompt"
import { cleanText } from "@/utils/content/utils"
import { db } from "@/utils/db/dexie/db"
import { Sha256Hex } from "@/utils/hash"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import {
  assertHtmlAttributeMarkerIntegrity,
  hasHtmlAttributeMarkerProtocol,
  isHtmlAttributeMarkerIntegrityError,
} from "@/utils/host/translate/html-attribute-markers"
import {
  auditInlineAtomTokens,
  hasInlineAtomTokens,
} from "@/utils/host/translate/inline-atom-tokens"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { canProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { TranslationCancelledError } from "@/utils/request/cancellation"
import { getOrGenerateTranslationContextSummary } from "./translation-context-summary"
import {
  buildTranslationScopeKey,
  createWebPageTranslationQueues,
  getLocalProviderConfig,
  shouldUseBatchQueue,
} from "./translation-queues"

async function getValidatedCachedTranslation(
  hash: string,
  sourceText: string,
  validateHtmlAttributeMarkers: boolean,
): Promise<string | undefined> {
  const cached = await db.translationCache.get(hash)
  if (!cached) return undefined
  if (!validateHtmlAttributeMarkers) return cached.translation

  try {
    assertHtmlAttributeMarkerIntegrity(sourceText, cached.translation)
    return cached.translation
  } catch (error) {
    if (!isHtmlAttributeMarkerIntegrityError(error)) throw error

    await db.translationCache.delete(hash)
    logger.warn("Deleted cached translation with invalid HTML attribute markers", error)
    return undefined
  }
}

/** Register handlers synchronously while queue initialization runs in the background. */
export function setupPageTranslationHandlers(): void {
  const { queuesPromise, cancelledScopes } = createWebPageTranslationQueues()

  onMessage("enqueueTranslateRequest", async (message) => {
    const { requestQueue, batchQueue } = await queuesPromise
    const {
      data: {
        text,
        langConfig,
        providerRef,
        scheduleAt,
        hash,
        textFormat,
        preserveLineBreaks,
        webTitle,
        webDescription,
        webContent,
        webSummary,
        sessionId,
        forceRetranslation = false,
        hostedFeature,
      },
    } = message
    const scope = buildTranslationScopeKey(message.sender, sessionId)

    const validateHtmlAttributeMarkers =
      textFormat === "html" && hasHtmlAttributeMarkerProtocol(text)
    if (validateHtmlAttributeMarkers) {
      assertHtmlAttributeMarkerIntegrity(text, text)
    }

    // Check cache first — unless the user asked for a fresh translation. The
    // existing entry is left untouched unless the fresh request succeeds below.
    if (hash && !forceRetranslation) {
      const cachedTranslation = await getValidatedCachedTranslation(
        hash,
        text,
        validateHtmlAttributeMarkers,
      )
      if (cachedTranslation !== undefined) return cachedTranslation
    }

    // The cache lookup above yielded — the session's cancel may have drained
    // the queues while this handler was suspended. Enqueueing now would park
    // an undraininable task on a dead scope, so abort instead (the content
    // side swallows this error).
    if (scope && cancelledScopes.has(scope)) {
      throw new TranslationCancelledError(scope)
    }

    let result: string
    const context: WebPagePromptContext = {
      webTitle: normalizePromptContextValue(webTitle),
      webDescription: normalizePromptContextValue(webDescription),
      webContent: normalizePromptContextValue(webContent),
      webSummary: normalizePromptContextValue(webSummary),
    }

    if (shouldUseBatchQueue(providerRef)) {
      const data = {
        text,
        langConfig,
        provider: providerRef,
        hash,
        scheduleAt,
        context,
        scope,
        hostedFeature,
      }
      result = await batchQueue.enqueue(data)
    } else {
      const localProvider = getLocalProviderConfig(providerRef)
      if (!localProvider) {
        throw new Error("Invalid local page translation provider")
      }
      // Create thunk based on type and params
      const thunk = (signal?: AbortSignal) =>
        executeTranslate(text, langConfig, localProvider, getTranslatePrompt, {
          textFormat,
          preserveLineBreaks,
          signal,
        })
      result = await requestQueue.enqueue(thunk, scheduleAt, hash, scope ? [scope] : undefined)
    }

    if (validateHtmlAttributeMarkers) {
      assertHtmlAttributeMarkerIntegrity(text, result)
    }

    // A response that dropped, invented or duplicated an inline-atom
    // placeholder is still rendered by the content script (the formulas are
    // appended) but must not be persisted: the next visit deserves a fresh
    // attempt instead of a permanently degraded paragraph. The sentinel is
    // exempt — "no translation needed" carries no placeholders by definition,
    // and auditing it as a total loss would make every already-in-target-language
    // paragraph containing a formula re-hit the provider on every page load.
    const inlineAtomTokensIntact =
      !hasInlineAtomTokens(text) ||
      isNoTranslationSentinel(result) ||
      auditInlineAtomTokens(text, result).ok
    if (result && !inlineAtomTokensIntact) {
      logger.warn("Inline atom placeholders were not preserved; result not cached")
    }

    // Cache the translation result if successful
    if (result && hash && inlineAtomTokensIntact) {
      await db.translationCache.put({
        key: hash,
        translation: result,
        createdAt: new Date(),
      })
    }

    return result
  })

  onMessage("getOrGenerateWebPageSummary", async (message) => {
    const { requestQueue } = await queuesPromise
    const { webTitle, webContent, providerRef } = message.data

    if (!webTitle || !webContent) {
      return null
    }

    // The payload type forces senders to narrow, but the wire is a trust
    // boundary (a pre-update content script can send a translate-only ref).
    // Refuse like the subtitle summary handlers do: a queue task for a
    // provider with no model to prompt can only ever throw, after burning
    // its retries.
    if (!canProviderRefGenerateText(providerRef)) {
      return null
    }

    return await getOrGenerateTranslationContextSummary({
      title: webTitle,
      textContent: webContent,
      providerRef,
      // The summary bills against the feature that triggered it (it is a
      // sub-call of that feature, not a feature of its own); the sender names
      // that route so the gate it serialized the ref under and the billing here
      // cannot diverge. Absent only from a pre-update content script — page
      // translation is the historical biller.
      hostedFeature: message.data.hostedFeature ?? "pageTranslation",
      cacheKeyParts: [webTitle, Sha256Hex(cleanText(webContent))],
      requestQueue,
    })
  })

  onMessage("cancelPageTranslationRequests", async (message) => {
    const scope = buildTranslationScopeKey(message.sender, message.data.sessionId)
    if (!scope) return
    // Remember the scope BEFORE any await so enqueue handlers suspended on
    // the cache lookup refuse to enqueue after this drain.
    cancelledScopes.markScope(scope)
    const { requestQueue, batchQueue } = await queuesPromise
    // Batch queue first so pending batches cannot flush new request-queue
    // tasks between the two drains.
    const cancelledBatch = batchQueue.cancelByScope(scope)
    const cancelledRequests = requestQueue.cancelByScope(scope)
    if (cancelledBatch + cancelledRequests > 0) {
      logger.info(
        `Cancelled ${cancelledBatch + cancelledRequests} page-translation requests (scope: ${scope})`,
      )
    }
  })

  // A closed tab can never send its cancel message — sweep every scope the
  // tab ever registered (#1881).
  browser.tabs.onRemoved.addListener((tabId) => {
    const prefix = `${tabId}:`
    cancelledScopes.markPrefix(prefix)
    void queuesPromise.then(({ requestQueue, batchQueue }) => {
      batchQueue.cancelWhere((scope) => scope.startsWith(prefix))
      requestQueue.cancelWhere((scope) => scope.startsWith(prefix))
    })
  })
}
