import type { ComponentProps, ReactNode } from "react"
import type { NoteSuggestionProviderRef, SelectionSession } from "../atoms"
import type { SelectionPopoverActions } from "@/components/ui/selection-popover"
import type { SelectionToolbarInlineError } from "@/components/ui/selection-popover/inline-error"
import type { ThinkingSnapshot } from "@/types/background-stream"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { useAtomValue, useSetAtom } from "jotai"
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { toastManager } from "@/components/ui/base-ui/toast"
import { SelectionPopover } from "@/components/ui/selection-popover"
import {
  createSelectionToolbarPrecheckError,
  createSelectionToolbarRuntimeError,
  isAbortError,
} from "@/components/ui/selection-popover/inline-error"
import { ReviewDueTab } from "@/components/ui/selection-popover/review-due-tab"
import { SelectionToolbarErrorAlert } from "@/components/ui/selection-popover/selection-toolbar-error-alert"
import {
  SelectionToolbarFooterContent,
  SelectionToolbarProviderSelect,
} from "@/components/ui/selection-popover/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "@/components/ui/selection-popover/selection-toolbar-title-content"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { isLLMProviderConfig } from "@/types/config/provider"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { onMessage } from "@/utils/message"
import { toSelectionPromptContext } from "@/utils/prompts/selection-context"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { shadowWrapper } from "../../main"
import { notifySelectionLookup } from "../../selection-lookups"
import { normalizeSelectedText } from "../../utils"
import {
  isSelectionToolbarOpenAtom,
  noteSuggestionProviderAtom,
  selectionSessionAtom,
  selectionToolbarTranslateRequestAtom,
} from "../atoms"
import { NoteSuggestionCard } from "../note-suggestion/note-suggestion-card"
import { useNoteSuggestion } from "../note-suggestion/use-note-suggestion"
import { useSelectionOpenRequestResolver } from "../use-selection-open-request"
import { useSelectionShortcuts } from "../use-selection-shortcuts"
import { checkSelectionTranslateProvider, translateSelection } from "./dispatch"
import { TargetLanguageSelector } from "./target-language-selector"
import { TranslationContent } from "./translation-content"

interface SelectionTranslatePendingOpenRequest {
  anchor?: { x: number; y: number }
  session: SelectionSession
  surface:
    | typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR
    | typeof ANALYTICS_SURFACE.CONTEXT_MENU
    | typeof ANALYTICS_SURFACE.SHORTCUT
}

/**
 * Keeps the hosted-status hook inside SelectionPopover.Content, which stays
 * unmounted until the popover first opens — the selection app mounts on every
 * page, and merely loading a page must not fire hosted-AI session/status
 * requests. Mirrors CustomActionPanel.ProviderSelect.
 */
function TranslateProviderSelect({
  providers,
  ...props
}: ComponentProps<typeof SelectionToolbarProviderSelect>) {
  const translateProviders = useHostedAiProviderOptions("selectionTranslation", providers)
  return <SelectionToolbarProviderSelect providers={translateProviders} {...props} />
}

interface SelectionTranslationContextValue {
  prepareToolbarOpen: () => void
  // Opens the translation from the toolbar without its button (from the
  // toolbar's "more" menu), anchored where that button would be.
  openToolbarTranslation: (anchorElement: HTMLElement | null) => void
}

const SelectionTranslationContext = createContext<SelectionTranslationContextValue | null>(null)

function useSelectionTranslationContext() {
  const context = use(SelectionTranslationContext)
  if (!context) {
    throw new Error(
      "Selection translation popover must be used within SelectionTranslationProvider.",
    )
  }

  return context
}

export function useSelectionTranslationPopover() {
  return useSelectionTranslationContext()
}

export function SelectionTranslationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [popoverSessionKey, setPopoverSessionKey] = useState(0)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const [thinking, setThinking] = useState<ThinkingSnapshot | null>(null)
  const [error, setError] = useState<SelectionToolbarInlineError | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [rerunNonce, setRerunNonce] = useState(0)
  const [sourceSurface, setSourceSurface] = useState<
    | typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR
    | typeof ANALYTICS_SURFACE.CONTEXT_MENU
    | typeof ANALYTICS_SURFACE.SHORTCUT
  >(ANALYTICS_SURFACE.SELECTION_TOOLBAR)
  const [activeSession, setActiveSession] = useState<SelectionSession | null>(null)
  const selectionSession = useAtomValue(selectionSessionAtom)
  const translateRequest = useAtomValue(selectionToolbarTranslateRequestAtom)
  const noteSuggestionProvider = useAtomValue(noteSuggestionProviderAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const setIsSelectionToolbarOpen = useSetAtom(isSelectionToolbarOpenAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pendingOpenRequestRef = useRef<SelectionTranslatePendingOpenRequest | null>(null)
  const popoverActionsRef = useRef<SelectionPopoverActions | null>(null)
  const lastTranslationRunKeyRef = useRef<string | null>(null)
  const runIdRef = useRef(0)
  const { resolveContextMenuOpenRequest, resolveShortcutOpenRequest } =
    useSelectionOpenRequestResolver(selectionSession)
  const selectionText = activeSession?.selectionSnapshot.text ?? null
  const paragraphsText = activeSession?.contextSnapshot.text ?? selectionText
  const selectionContext = useMemo(
    () =>
      toSelectionPromptContext(
        activeSession?.contextSnapshot.paragraphs,
        activeSession?.selectionSnapshot.text ?? "",
      ),
    [activeSession],
  )
  const titleText = getSourceDocumentTitle() || null
  const translateProviders = useMemo(
    () => getSelectableProvidersForCapability("selectionTranslation", providersConfig),
    [providersConfig],
  )
  const translateRequestKey = useMemo(() => JSON.stringify(translateRequest), [translateRequest])
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const {
    suggestion: noteSuggestion,
    maybeFire: maybeFireNoteSuggestion,
    cancel: cancelNoteSuggestion,
    resetSession: resetNoteSuggestionSession,
    markShownOnce: markNoteSuggestionShownOnce,
  } = useNoteSuggestion()

  // Suggestion identity must change whenever a translation re-run would produce
  // different notes (target language / provider change bumps translateRequestKey;
  // regenerate bumps rerunNonce). Keying only on popoverSessionKey would leave a
  // stale old-language suggestion rendered after the new translation.
  const noteSuggestionSessionKey = `${popoverSessionKey}:${translateRequestKey}:${rerunNonce}`

  const fireNoteSuggestion = useEffectEvent(
    (preparedText: string, provider: NoteSuggestionProviderRef) => {
      maybeFireNoteSuggestion({
        sessionKey: noteSuggestionSessionKey,
        selectionText: preparedText,
        // Kept in the note's selection fields as a custom action run keeps it,
        // not as prepared for translation.
        savedSelectionText: normalizeSelectedText(selectionText),
        paragraphsText: paragraphsText ?? preparedText,
        targetLangName: LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode],
        webTitle: titleText ?? "",
        provider,
      })
    },
  )

  const resetPopoverSession = useCallback((options?: { clearAnchor?: boolean }) => {
    setActiveSession(null)
    if (options?.clearAnchor) {
      setAnchor(null)
    }
  }, [])

  const resetTranslationState = useCallback(() => {
    setIsTranslating(false)
    setTranslatedText(undefined)
    setThinking(null)
    setError(null)
  }, [])

  const cancelCurrentTranslation = useCallback(
    (runId?: number) => {
      if (runId !== undefined && runIdRef.current !== runId) {
        return
      }

      runIdRef.current += 1
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      cancelNoteSuggestion()
    },
    [cancelNoteSuggestion],
  )

  // Anchor application is owned by SelectionPopover.Root (via requestOpen) so
  // a pinned popover reused in place never moves.
  const commitOpenRequest = useCallback((request: SelectionTranslatePendingOpenRequest) => {
    pendingOpenRequestRef.current = request
  }, [])

  const applyPendingSession = useCallback(() => {
    const pendingRequest = pendingOpenRequestRef.current

    const session = pendingRequest?.session ?? selectionSession
    setActiveSession(session)
    notifySelectionLookup(session)
    setSourceSurface(pendingRequest?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR)
    setIsSelectionToolbarOpen(false)
    pendingOpenRequestRef.current = null
  }, [selectionSession, setIsSelectionToolbarOpen])

  const handleProviderChange = useCallback(
    (providerId: string) => {
      void setConfig(buildFeatureProviderPatch({ selectionTranslation: providerId }))
    },
    [setConfig],
  )

  const handleRegenerate = useCallback(() => {
    cancelCurrentTranslation()
    setRerunNonce((prev) => prev + 1)
  }, [cancelCurrentTranslation])

  const runTranslation = useCallback(
    async (runId: number) => {
      const preparedText = prepareTranslationText(selectionText)

      if (preparedText === "") {
        if (runIdRef.current === runId) {
          resetTranslationState()
        }
        return
      }

      const analyticsContext = createFeatureUsageContext(
        ANALYTICS_FEATURE.SELECTION_TRANSLATION,
        sourceSurface,
      )
      const providerAnalytics = classifyResolvedProvider(translateRequest.provider)
      const target_language = translateRequest.language.targetCode

      setIsTranslating(true)
      setTranslatedText(undefined)
      setThinking(null)
      setError(null)

      const provider = translateRequest.provider
      const precheck = checkSelectionTranslateProvider(provider)
      if (precheck || !provider) {
        if (runIdRef.current === runId) {
          setIsTranslating(false)
          setError(
            createSelectionToolbarPrecheckError("translate", precheck ?? "providerUnavailable"),
          )
        }
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          char_count: preparedText.length,
          target_language,
          outcome: "failure",
          failure_reason: "precheck",
        })
        return
      }

      try {
        // Hosted and LLM providers stream, thinking first; a pure translate
        // provider answers in one go.
        const streams = provider.kind === "system" || isLLMProviderConfig(provider.config)
        setThinking(streams ? { status: "thinking", text: "" } : null)

        const result = await translateSelection({
          preparedText,
          provider,
          translateRequest,
          selectionContext,
          onChunk: (data) => {
            if (runIdRef.current === runId) {
              setTranslatedText(data.output)
              setThinking(data.thinking)
            }
          },
          registerAbortController: (abortController) => {
            abortControllerRef.current = abortController
          },
        })

        if (runIdRef.current === runId) {
          setThinking(result.thinking)
          setTranslatedText(result.output)
        }

        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          char_count: preparedText.length,
          target_language,
          outcome: "success",
        })
      } catch (caughtError) {
        if (!isAbortError(caughtError) && runIdRef.current === runId) {
          setThinking((prev) => (prev?.text ? { ...prev, status: "complete" } : null))
          setError(createSelectionToolbarRuntimeError("translate", caughtError))
        }

        if (!isAbortError(caughtError)) {
          void trackFeatureUsed({
            ...analyticsContext,
            ...providerAnalytics,
            char_count: preparedText.length,
            target_language,
            outcome: "failure",
            failure_reason: classifyFailureReason(caughtError),
          })
        }
      } finally {
        if (runIdRef.current === runId) {
          abortControllerRef.current = null
          setIsTranslating(false)
        }
      }
    },
    [resetTranslationState, selectionContext, selectionText, sourceSurface, translateRequest],
  )

  const startTranslation = useEffectEvent((runId: number) => {
    // Kick off the note suggestion together with a translation run. The
    // suggestion runs on its own configured provider (independent of the
    // translate provider, which may be Google/Microsoft): a local provider
    // must be enabled + LLM; a hosted (system) ref is availability-gated
    // inside the hook via hosted status. The card renders only after the
    // translation stream finishes.
    const preparedText = prepareTranslationText(selectionText)
    const suggestionProvider = noteSuggestionProvider
    if (
      preparedText !== "" &&
      suggestionProvider &&
      (suggestionProvider.kind === "system" ||
        (suggestionProvider.config.enabled && isLLMProviderConfig(suggestionProvider.config)))
    ) {
      fireNoteSuggestion(preparedText, suggestionProvider)
    }

    void runTranslation(runId)
  })

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const nextRunKey = JSON.stringify({
      popoverSessionKey,
      rerunNonce,
      sessionId: activeSession?.id ?? null,
      translateRequestKey,
    })
    if (lastTranslationRunKeyRef.current === nextRunKey) {
      return undefined
    }
    lastTranslationRunKeyRef.current = nextRunKey

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    startTranslation(runId)

    return () => {
      cancelCurrentTranslation(runId)
    }
  }, [
    activeSession?.id,
    cancelCurrentTranslation,
    isOpen,
    popoverSessionKey,
    rerunNonce,
    translateRequestKey,
  ])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      cancelCurrentTranslation()
      resetTranslationState()

      if (nextOpen) {
        setPopoverSessionKey((prev) => prev + 1)
        applyPendingSession()
      } else {
        resetPopoverSession({
          clearAnchor: pendingOpenRequestRef.current === null,
        })
        lastTranslationRunKeyRef.current = null
        resetNoteSuggestionSession()
      }

      setIsOpen(nextOpen)
    },
    [
      applyPendingSession,
      cancelCurrentTranslation,
      resetPopoverSession,
      resetNoteSuggestionSession,
      resetTranslationState,
    ],
  )

  // Pinned popovers are reused in place for a new selection: the window keeps
  // its position, size, and pin state while the translation restreams. All
  // state writes stay in one handler so the translation run-key effect
  // observes exactly one key change.
  const handleReuseRequest = useCallback(() => {
    cancelCurrentTranslation()
    resetTranslationState()
    resetNoteSuggestionSession()
    applyPendingSession()
    // Forces a rerun even when the same selection session is retriggered, and
    // rotates the note-suggestion session key (which has no session id).
    setRerunNonce((prev) => prev + 1)
  }, [
    applyPendingSession,
    cancelCurrentTranslation,
    resetNoteSuggestionSession,
    resetTranslationState,
  ])

  const prepareToolbarOpen = useCallback(() => {
    if (!selectionSession) {
      return
    }

    commitOpenRequest({
      session: selectionSession,
      surface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
    })
  }, [commitOpenRequest, selectionSession])

  const resolveContextMenuRequest = useCallback((): SelectionTranslatePendingOpenRequest | null => {
    const request = resolveContextMenuOpenRequest()
    if (!request) {
      return null
    }

    return {
      anchor: request.anchor,
      session: request.session,
      surface: ANALYTICS_SURFACE.CONTEXT_MENU,
    }
  }, [resolveContextMenuOpenRequest])

  const resolveShortcutRequest = useCallback(
    (session: SelectionSession | null): SelectionTranslatePendingOpenRequest | null => {
      const request = resolveShortcutOpenRequest(session)
      if (!request) {
        return null
      }

      return {
        anchor: request.anchor,
        session: request.session,
        surface: ANALYTICS_SURFACE.SHORTCUT,
      }
    },
    [resolveShortcutOpenRequest],
  )

  const openSelectionTranslationRequest = useCallback(
    (
      request: SelectionTranslatePendingOpenRequest | null,
      options?: { showMissingSelectionToast?: boolean },
    ) => {
      if (!request) {
        if (options?.showMissingSelectionToast) {
          const nextError = createSelectionToolbarPrecheckError("translate", "missingSelection")
          toastManager.add({ type: "error", title: nextError.description })
        }
        return
      }

      commitOpenRequest(request)
      popoverActionsRef.current?.requestOpen(request.anchor ?? null)
    },
    [commitOpenRequest],
  )

  const openToolbarTranslation = useCallback(
    (anchorElement: HTMLElement | null) => {
      if (!selectionSession || !anchorElement) {
        return
      }

      const rect = anchorElement.getBoundingClientRect()
      openSelectionTranslationRequest({
        anchor: { x: rect.left, y: rect.top },
        session: selectionSession,
        surface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
      })
    },
    [openSelectionTranslationRequest, selectionSession],
  )

  const openFromContextMenu = useCallback(() => {
    openSelectionTranslationRequest(resolveContextMenuRequest(), {
      showMissingSelectionToast: true,
    })
  }, [openSelectionTranslationRequest, resolveContextMenuRequest])

  // Turned off, the button and its key go together, as Speak's and the actions' do. Hiding the
  // whole toolbar does not stop the key.
  useSelectionShortcuts(
    {
      translate: selectionToolbar.features.translate.enabled
        ? selectionToolbar.features.translate.shortcut
        : undefined,
    },
    (_, session) => {
      const request = resolveShortcutRequest(session)
      if (!request) {
        return false
      }
      openSelectionTranslationRequest(request)
      return true
    },
  )

  useEffect(() => {
    return onMessage("openSelectionTranslationFromContextMenu", () => {
      openFromContextMenu()
    })
  }, [openFromContextMenu])

  const contextValue = useMemo<SelectionTranslationContextValue>(
    () => ({
      prepareToolbarOpen,
      openToolbarTranslation,
    }),
    [openToolbarTranslation, prepareToolbarOpen],
  )

  return (
    <SelectionTranslationContext value={contextValue}>
      <SelectionPopover.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        anchor={anchor}
        onAnchorChange={setAnchor}
        actionsRef={popoverActionsRef}
        onReuseRequest={handleReuseRequest}
        disablePointerDismissal={isSaveToNotebaseDialogOpen}
      >
        {children}
        <SelectionPopover.Content
          key={popoverSessionKey}
          container={shadowWrapper ?? document.body}
          finalFocus={false}
        >
          <SelectionPopover.Header className="border-b">
            <SelectionToolbarTitleContent title="Translation" icon="ri:translate" />
            <div className="flex items-center gap-1">
              <TargetLanguageSelector />
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>

          <SelectionPopover.Body key={`${popoverSessionKey}:${activeSession?.id ?? 0}`}>
            <TranslationContent
              selectionContent={selectionText}
              translatedText={translatedText}
              isTranslating={isTranslating}
              thinking={thinking}
            />
            {!isTranslating &&
              !!translatedText &&
              !error &&
              noteSuggestion?.sessionKey === noteSuggestionSessionKey && (
                <NoteSuggestionCard
                  key={noteSuggestion.sessionKey}
                  suggestion={noteSuggestion}
                  markShownOnce={markNoteSuggestionShownOnce}
                />
              )}
            <SelectionToolbarErrorAlert error={error} className="-mt-3" />
          </SelectionPopover.Body>
          <ReviewDueTab source="extension_selection_translation" />
          <SelectionToolbarFooterContent
            start={
              <TranslateProviderSelect
                providers={translateProviders}
                value={translateRequest.provider?.id ?? ""}
                onChange={handleProviderChange}
              />
            }
            paragraphsText={paragraphsText}
            titleText={titleText}
            onRegenerate={handleRegenerate}
          />
        </SelectionPopover.Content>
      </SelectionPopover.Root>
    </SelectionTranslationContext>
  )
}
