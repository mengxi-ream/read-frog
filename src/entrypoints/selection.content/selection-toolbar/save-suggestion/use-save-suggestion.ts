import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { ValidatedSaveSuggestion } from "@/utils/save-suggestion/types"
import { useAtomValue } from "jotai"
import { useCallback, useRef, useState } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { CUSTOM_ACTION_TEMPLATES } from "@/utils/constants/custom-action-templates"
import { streamBackgroundNoteSuggestion } from "@/utils/content-script/background-stream-client"
import { logger } from "@/utils/logger"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"
import { isSaveSuggestionEligible } from "@/utils/save-suggestion/cooldown"
import { saveSuggestionEnvelopeSchema } from "@/utils/save-suggestion/types"
import { validateSaveSuggestion } from "@/utils/save-suggestion/validate"
import { isAbortError } from "../inline-error"
import { buildSaveSuggestionPrompts } from "./prompt"
import {
  isSaveSuggestionSuppressedForPageSession,
  suppressSaveSuggestionForPageSession,
} from "./session-guard"

export interface SaveSuggestionSessionResult {
  /** Composite key: popoverSessionKey:translateRequestKey:rerunNonce. */
  sessionKey: string
  validated: ValidatedSaveSuggestion
  /** The chosen action as of fire time (config copy, or the dictionary draft). */
  actionSnapshot: SelectionToolbarCustomAction
  /** Non-null iff the target is `create_dictionary`. */
  dictionaryDraft: SelectionToolbarCustomAction | null
  /** When the request was fired (for latency analytics). */
  firedAt: number
}

export interface SaveSuggestionFireInput {
  sessionKey: string
  selectionText: string
  paragraphsText: string
  /** English name of the target language. */
  targetLangName: string
  webTitle: string
}

/**
 * Owns the "guess you want to save" AI request lifecycle. Fired when a
 * translation run starts; the card renders the result only after the
 * translation finishes. An aborted request is "never happened"; an invalid or
 * empty result additionally suppresses the feature for the page session.
 */
export function useSaveSuggestion() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const [suggestion, setSuggestion] = useState<SaveSuggestionSessionResult | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const completedSessionKeyRef = useRef<string | null>(null)
  const shownSessionKeyRef = useRef<string | null>(null)
  const latestRef = useRef(selectionToolbar)
  latestRef.current = selectionToolbar

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const resetSession = useCallback(() => {
    cancel()
    setSuggestion(null)
  }, [cancel])

  /** Returns true only the first time it is called for a session. */
  const markShownOnce = useCallback((sessionKey: string) => {
    if (shownSessionKeyRef.current === sessionKey) {
      return false
    }
    shownSessionKeyRef.current = sessionKey
    return true
  }, [])

  const maybeFire = useCallback((input: SaveSuggestionFireInput) => {
    const config = latestRef.current
    if (!config.saveSuggestion.enabled) {
      return
    }
    if (isSaveSuggestionSuppressedForPageSession()) {
      return
    }
    if (completedSessionKeyRef.current === input.sessionKey) {
      return
    }
    if (abortControllerRef.current) {
      return
    }
    if (!input.selectionText.trim()) {
      return
    }

    const dictionaryTemplate = CUSTOM_ACTION_TEMPLATES.find(
      (template) => template.id === "dictionary",
    )
    if (!dictionaryTemplate) {
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const { signal } = abortController
    const firedAt = Date.now()

    const run = async () => {
      if (!(await isSaveSuggestionEligible(firedAt)) || signal.aborted) {
        return
      }

      // Snapshot candidates and the dictionary draft at fire time so the
      // prompt, the validation schema, and the action created at dialog
      // confirm all share identical fields.
      const enabledActions = config.customActions.filter((action) => action.enabled !== false)
      const dictionaryDraft = dictionaryTemplate.createAction(BUILT_IN_AI_PROVIDER_ID)

      const { systemPrompt, prompt } = buildSaveSuggestionPrompts({
        selection: input.selectionText,
        paragraphs: input.paragraphsText,
        targetLanguage: input.targetLangName,
        webTitle: input.webTitle,
        candidates: enabledActions,
        dictionaryDraft,
      })

      const snapshot = await streamBackgroundNoteSuggestion(
        {
          providerId: BUILT_IN_AI_PROVIDER_ID,
          instructions: systemPrompt,
          prompt,
        },
        { signal },
      )
      if (signal.aborted) {
        return
      }

      const envelope = saveSuggestionEnvelopeSchema.safeParse(snapshot.output)
      const validated = envelope.success
        ? validateSaveSuggestion({
            envelope: envelope.data,
            candidates: enabledActions,
            dictionaryDraft,
          })
        : null

      completedSessionKeyRef.current = input.sessionKey

      if (!validated) {
        suppressSaveSuggestionForPageSession()
        return
      }

      const actionSnapshot =
        validated.target.kind === "create_dictionary"
          ? dictionaryDraft
          : (enabledActions.find(
              (action) =>
                validated.target.kind === "existing" && action.id === validated.target.actionId,
            ) ?? dictionaryDraft)

      setSuggestion({
        sessionKey: input.sessionKey,
        validated,
        actionSnapshot,
        dictionaryDraft: validated.target.kind === "create_dictionary" ? dictionaryDraft : null,
        firedAt,
      })
    }

    void run()
      .catch((error: unknown) => {
        if (isAbortError(error) || signal.aborted) {
          return
        }

        completedSessionKeyRef.current = input.sessionKey
        suppressSaveSuggestionForPageSession()
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
