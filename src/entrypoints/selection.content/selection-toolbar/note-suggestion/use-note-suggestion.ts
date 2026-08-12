import type { NoteSuggestionProviderRef } from "../atoms"
import type { FeatureProviderAnalytics } from "@/types/analytics"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { ValidatedNoteSuggestion } from "@/utils/note-suggestion/types"
import { useAtomValue } from "jotai"
import { useCallback, useRef, useState } from "react"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { streamBackgroundNoteSuggestion } from "@/utils/content-script/background-stream-client"
import { STREAM_PORT_DISCONNECTED_MESSAGE } from "@/utils/content-script/port-streaming"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { resolveNoteSuggestionAction } from "@/utils/custom-actions"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { getHostedAiTierStatus } from "@/utils/hosted-ai/status"
import { logger } from "@/utils/logger"
import { noteSuggestionEnvelopeSchema } from "@/utils/note-suggestion/types"
import { validateNoteSuggestion } from "@/utils/note-suggestion/validate"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { fetchHostedAiStatus } from "@/utils/providers/provider-ref"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"
import { isAbortError } from "../inline-error"
import { buildNoteSuggestionPrompts } from "./prompt"

export interface NoteSuggestionSessionResult {
  /** Composite key: popoverSessionKey:translateRequestKey:rerunNonce. */
  sessionKey: string
  validated: ValidatedNoteSuggestion
  /** The configured Note suggestion action as of fire time. */
  actionSnapshot: SelectionToolbarCustomAction
  /** When the request was fired (for latency analytics). */
  firedAt: number
  /** Analytics classification of the provider that generated this suggestion. */
  analyticsProvider: FeatureProviderAnalytics
}

export interface NoteSuggestionFireInput {
  sessionKey: string
  selectionText: string
  paragraphsText: string
  /** English name of the target language. */
  targetLangName: string
  webTitle: string
  /**
   * The suggestion's own resolved provider (config.selectionToolbar
   * .noteSuggestion.providerId) — local guaranteed enabled + LLM by the
   * caller; system refs are availability-gated inside via hosted status.
   */
  provider: NoteSuggestionProviderRef
}

/**
 * Owns the "guess you want to save" AI request lifecycle, running on the save
 * suggestion's own provider — a local LLM or hosted Built-in AI. Fired when a
 * translation run starts; the card renders the result only after the
 * translation finishes. Every eligible fire attempts a request (no failure
 * backoff — selection translation is human-paced, and a failed LLM call is
 * near-free): failures are silent, at most once per popover session. The one
 * pre-request gate is hosted status: a Built-in provider whose tier is
 * explicitly unavailable (not signed in, needs Ultra, quota exhausted,
 * service down) skips without issuing the doomed stream call. A valid
 * response with zero notes is a success (nothing worth saving) that renders
 * no card.
 */
export function useNoteSuggestion() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const [suggestion, setSuggestion] = useState<NoteSuggestionSessionResult | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // Sets rather than single slots so an A→B→A key round-trip inside one
  // popover (e.g. peeking at another target language) neither re-fires a
  // completed request nor double-counts the shown analytics event. Cleared
  // when the popover closes to keep them bounded.
  const completedSessionKeysRef = useRef<Set<string>>(new Set())
  const shownSessionKeysRef = useRef<Set<string>>(new Set())
  const latestRef = useRef(selectionToolbar)
  latestRef.current = selectionToolbar

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const resetSession = useCallback(() => {
    cancel()
    completedSessionKeysRef.current.clear()
    shownSessionKeysRef.current.clear()
    setSuggestion(null)
  }, [cancel])

  /** Returns true only the first time it is called for a session. */
  const markShownOnce = useCallback((sessionKey: string) => {
    if (shownSessionKeysRef.current.has(sessionKey)) {
      return false
    }
    shownSessionKeysRef.current.add(sessionKey)
    return true
  }, [])

  const maybeFire = useCallback((input: NoteSuggestionFireInput) => {
    const config = latestRef.current
    if (!config.noteSuggestion.enabled) {
      return
    }
    if (completedSessionKeysRef.current.has(input.sessionKey)) {
      return
    }
    if (abortControllerRef.current) {
      return
    }
    if (!input.selectionText.trim()) {
      return
    }

    const actionSnapshot = structuredClone(resolveNoteSuggestionAction(config))

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const { signal } = abortController
    const firedAt = Date.now()
    const provider = input.provider

    const run = async () => {
      if (signal.aborted) {
        return
      }

      if (provider.kind === "system") {
        // A background auto-fire feature must not hammer a hosted tier the
        // account cannot use: skip silently on any explicit unavailable
        // verdict — durable facts (sign-in, Ultra plan) and reported runtime
        // state (quota exhausted, service down) alike, since nobody is
        // watching to act on the error and status is far cheaper than a
        // doomed stream call. Fail open when status itself is unreachable —
        // the run surfaces any real error, which `fetchHostedAiStatus` already
        // does; going through it also shares the request with whatever else
        // resolves a hosted ref at the same moment, since one status response
        // covers every feature.
        const status = await fetchHostedAiStatus()
        if (signal.aborted) {
          return
        }
        const tierStatus = getHostedAiTierStatus(status, "noteSuggestion", provider.modelTier)
        if (tierStatus && !tierStatus.available) {
          logger.info(
            "[NoteSuggestion] Skipped: hosted tier unavailable",
            tierStatus.unavailableReason,
          )
          completedSessionKeysRef.current.add(input.sessionKey)
          return
        }
      }

      const webPageContext = await getOrCreateWebPageContext().catch(() => null)
      if (signal.aborted) {
        return
      }

      // Prompt construction and semantic validation share the exact action
      // snapshot captured synchronously when this request fired.
      const { systemPrompt, prompt } = buildNoteSuggestionPrompts({
        selection: input.selectionText,
        paragraphs: input.paragraphsText,
        targetLanguage: input.targetLangName,
        webTitle: input.webTitle,
        webContent: webPageContext?.webContent ?? "",
        action: actionSnapshot,
        envelopeContract: provider.kind === "system" ? "hosted" : "local",
      })

      const payload =
        provider.kind === "system"
          ? {
              providerId: provider.id,
              modelTier: provider.modelTier,
              requestId: getRandomUUID(),
              instructions: systemPrompt,
              prompt,
            }
          : {
              providerId: provider.id,
              instructions: systemPrompt,
              prompt,
              providerOptions: getProviderOptionsWithOverride(
                resolveModelId(provider.config.model) ?? "",
                provider.config.provider,
                provider.config.providerOptions,
                getTopLevelReasoning(provider.config),
              ),
              reasoning: getTopLevelReasoning(provider.config),
              temperature: provider.config.temperature,
            }

      const snapshot = await streamBackgroundNoteSuggestion(payload, { signal })
      if (signal.aborted) {
        return
      }

      const envelope = noteSuggestionEnvelopeSchema.safeParse(snapshot.output)

      completedSessionKeysRef.current.add(input.sessionKey)

      // The prompt sanctions an empty notes array ("truly nothing worth
      // saving"): the provider worked correctly, it just renders no card.
      if (envelope.success && envelope.data.notes.length === 0) {
        return
      }

      const validated = envelope.success
        ? validateNoteSuggestion({
            envelope: envelope.data,
            action: actionSnapshot,
          })
        : null

      if (!validated) {
        logger.info("[NoteSuggestion] Discarded schema/semantically invalid suggestion output")
        return
      }

      setSuggestion({
        sessionKey: input.sessionKey,
        validated,
        actionSnapshot,
        firedAt,
        analyticsProvider: classifyResolvedProvider(provider),
      })
    }

    void run()
      .catch((error: unknown) => {
        if (isAbortError(error) || signal.aborted) {
          return
        }

        // A dropped background port (service worker restart, extension
        // reload) is an infrastructure hiccup, not the provider's fault:
        // treat it like an abort so it does not block a later attempt for
        // this session.
        if (error instanceof Error && error.message === STREAM_PORT_DISCONNECTED_MESSAGE) {
          logger.info("[NoteSuggestion] Suggestion stream port disconnected", error)
          return
        }

        completedSessionKeysRef.current.add(input.sessionKey)
        logger.info("[NoteSuggestion] Suggestion request failed", error)
      })
      .finally(() => {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null
        }
      })
  }, [])

  return {
    suggestion,
    maybeFire,
    cancel,
    resetSession,
    markShownOnce,
  }
}
