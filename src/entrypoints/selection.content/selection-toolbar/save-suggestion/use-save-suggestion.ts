import type { FeatureProviderAnalytics } from "@/types/analytics"
import type { LLMProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { ValidatedSaveSuggestion } from "@/utils/save-suggestion/types"
import { useAtomValue } from "jotai"
import { useCallback, useRef, useState } from "react"
import { classifyProviderConfig } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { streamBackgroundNoteSuggestion } from "@/utils/content-script/background-stream-client"
import { STREAM_PORT_DISCONNECTED_MESSAGE } from "@/utils/content-script/port-streaming"
import { resolveSaveSuggestionAction } from "@/utils/custom-actions"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { logger } from "@/utils/logger"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"
import {
  getSaveSuggestionProviderFingerprint,
  isSaveSuggestionAttemptAllowed,
  recordSaveSuggestionFailure,
  recordSaveSuggestionSuccess,
} from "@/utils/save-suggestion/provider-cooldown"
import { saveSuggestionEnvelopeSchema } from "@/utils/save-suggestion/types"
import { validateSaveSuggestion } from "@/utils/save-suggestion/validate"
import { isAbortError } from "../inline-error"
import { buildSaveSuggestionPrompts } from "./prompt"

export interface SaveSuggestionSessionResult {
  /** Composite key: popoverSessionKey:translateRequestKey:rerunNonce. */
  sessionKey: string
  validated: ValidatedSaveSuggestion
  /** The configured Save Suggestion action as of fire time. */
  actionSnapshot: SelectionToolbarCustomAction
  /** When the request was fired (for latency analytics). */
  firedAt: number
  /** Analytics classification of the provider that generated this suggestion. */
  analyticsProvider: FeatureProviderAnalytics
}

export interface SaveSuggestionFireInput {
  sessionKey: string
  selectionText: string
  paragraphsText: string
  /** English name of the target language. */
  targetLangName: string
  webTitle: string
  /** The resolved selection-translate provider (guaranteed local + enabled + LLM by the caller). */
  providerId: string
  providerConfig: LLMProviderConfig
}

/**
 * Owns the "guess you want to save" AI request lifecycle, running on the
 * user's selection-translate LLM provider. Fired when a translation run
 * starts; the card renders the result only after the translation finishes. An
 * aborted request (or a dropped background port) is "never happened"; a
 * request error or schema/semantically invalid output records a failure in
 * the persisted per-provider cooldown, which doubles from 2 minutes without
 * cap until a success or a provider (config) change resets it. A valid
 * response with zero notes is a success (nothing worth saving) that renders
 * no card.
 */
export function useSaveSuggestion() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const [suggestion, setSuggestion] = useState<SaveSuggestionSessionResult | null>(null)
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

  const maybeFire = useCallback((input: SaveSuggestionFireInput) => {
    const config = latestRef.current
    if (!config.saveSuggestion.enabled) {
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

    const actionSnapshot = structuredClone(resolveSaveSuggestionAction(config))

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const { signal } = abortController
    const firedAt = Date.now()
    // Snapshotted synchronously at fire time so a mid-flight provider config
    // change cannot skew which cooldown bucket this attempt records into.
    const providerKey = {
      providerId: input.providerId,
      providerFingerprint: getSaveSuggestionProviderFingerprint(input.providerConfig),
    }

    const run = async () => {
      if (!(await isSaveSuggestionAttemptAllowed(providerKey, firedAt)) || signal.aborted) {
        return
      }

      const webPageContext = await getOrCreateWebPageContext().catch(() => null)
      if (signal.aborted) {
        return
      }

      // Prompt construction and semantic validation share the exact action
      // snapshot captured synchronously when this request fired.
      const { systemPrompt, prompt } = buildSaveSuggestionPrompts({
        selection: input.selectionText,
        paragraphs: input.paragraphsText,
        targetLanguage: input.targetLangName,
        webTitle: input.webTitle,
        webContent: webPageContext?.webContent ?? "",
        action: actionSnapshot,
      })

      const modelName = resolveModelId(input.providerConfig.model) ?? ""
      const reasoning = getTopLevelReasoning(input.providerConfig)
      const providerOptions = getProviderOptionsWithOverride(
        modelName,
        input.providerConfig.provider,
        input.providerConfig.providerOptions,
        reasoning,
      )

      const snapshot = await streamBackgroundNoteSuggestion(
        {
          providerId: input.providerId,
          instructions: systemPrompt,
          prompt,
          providerOptions,
          reasoning,
          temperature: input.providerConfig.temperature,
        },
        { signal },
      )
      if (signal.aborted) {
        return
      }

      const envelope = saveSuggestionEnvelopeSchema.safeParse(snapshot.output)

      completedSessionKeysRef.current.add(input.sessionKey)

      // The prompt sanctions an empty notes array ("truly nothing worth
      // saving"): the provider worked correctly, so this resets the failure
      // cooldown but renders no card.
      if (envelope.success && envelope.data.notes.length === 0) {
        void recordSaveSuggestionSuccess()
        return
      }

      const validated = envelope.success
        ? validateSaveSuggestion({
            envelope: envelope.data,
            action: actionSnapshot,
          })
        : null

      if (!validated) {
        void recordSaveSuggestionFailure(providerKey)
        return
      }

      void recordSaveSuggestionSuccess()

      setSuggestion({
        sessionKey: input.sessionKey,
        validated,
        actionSnapshot,
        firedAt,
        analyticsProvider: classifyProviderConfig(input.providerConfig),
      })
    }

    void run()
      .catch((error: unknown) => {
        if (isAbortError(error) || signal.aborted) {
          return
        }

        // A dropped background port (service worker restart, extension
        // reload) is an infrastructure hiccup, not the provider's fault:
        // treat it like an abort so it neither counts toward the failure
        // cooldown nor blocks a later attempt for this session.
        if (error instanceof Error && error.message === STREAM_PORT_DISCONNECTED_MESSAGE) {
          logger.info("[SaveSuggestion] Suggestion stream port disconnected", error)
          return
        }

        completedSessionKeysRef.current.add(input.sessionKey)
        void recordSaveSuggestionFailure(providerKey)
        logger.info("[SaveSuggestion] Suggestion request failed", error)
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
