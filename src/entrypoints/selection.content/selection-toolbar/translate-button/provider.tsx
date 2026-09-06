import type { Hotkey } from "@tanstack/hotkeys"
import type { ComponentProps, ReactNode } from "react"
import type {
  NoteSuggestionProviderRef,
  SelectionSession,
  SelectionToolbarTranslateRequestSlice,
} from "../atoms"
import type { SelectionToolbarInlineError } from "../inline-error"
import type { SelectionPopoverActions } from "@/components/ui/selection-popover"
import type { BackgroundTextStreamSnapshot, ThinkingSnapshot } from "@/types/background-stream"
import type { LLMProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import type { ResolvedProviderRef, SystemProviderRef } from "@/utils/providers/provider-registry"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { HotkeyManager } from "@tanstack/hotkeys"
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
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { toastManager } from "@/components/ui/base-ui/toast"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { isLLMProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { translateTextCore } from "@/utils/host/translate/translate-text"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { getOrGenerateWebPageSummary } from "@/utils/host/translate/webpage-summary"
import { onMessage } from "@/utils/message"
import {
  isPageTranslationShortcutEmpty,
  isValidConfiguredPageTranslationShortcut,
} from "@/utils/page-translation-shortcut"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { checkProviderAvailability } from "@/utils/providers/provider-ref"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"
import { shadowWrapper } from "../.."
import { SelectionToolbarErrorAlert } from "../../components/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "../../components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "../../components/selection-toolbar-title-content"
import {
  isSelectionToolbarOpenAtom,
  noteSuggestionProviderAtom,
  selectionSessionAtom,
  selectionToolbarTranslateRequestAtom,
} from "../atoms"
import { isSaveToNotebaseDialogOpenAtom } from "../custom-action-button/save-to-notebase-dialog-atom"
import {
  createSelectionToolbarPrecheckError,
  createSelectionToolbarRuntimeError,
  isAbortError,
} from "../inline-error"
import { NoteSuggestionCard } from "../note-suggestion/note-suggestion-card"
import { useNoteSuggestion } from "../note-suggestion/use-note-suggestion"
import { useSelectionOpenRequestResolver } from "../use-selection-open-request"
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
 * Page context for the selection prompt. `summaryProviderRef` is the provider
 * the (cached, smart-context-gated) page summary runs on — hosted and local
 * LLM refs both work; pass null to skip the summary while keeping the raw
 * context (pure translate providers, hosted tier unavailable).
 */
async function getSelectionWebPagePromptContext(
  summaryProviderRef: PromptableProviderRef | null,
  enableAIContentAware: boolean,
) {
  const webPageContext = await getOrCreateWebPageContext()
  if (!webPageContext) {
    return undefined
  }

  const webSummary = summaryProviderRef
    ? await getOrGenerateWebPageSummary(
        webPageContext,
        summaryProviderRef,
        enableAIContentAware,
        "selectionTranslation",
      )
    : null
  return {
    webTitle: webPageContext.webTitle,
    webDescription: webPageContext.webDescription,
    webContent: webPageContext.webContent,
    webSummary: webSummary ?? undefined,
  }
}

async function translateWithTextStream({
  preparedText,
  providerId,
  providerConfig,
  translateRequest,
  onChunk,
  registerAbortController,
}: {
  preparedText: string
  providerId: string
  providerConfig: LLMProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
  onChunk: (data: BackgroundTextStreamSnapshot) => void
  registerAbortController: (abortController: AbortController) => void
}) {
  const targetLangName = LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode]
  const modelName = resolveModelId(providerConfig.model)
  const reasoning = getTopLevelReasoning(providerConfig)
  const providerOptions = getProviderOptionsWithOverride(
    modelName ?? "",
    providerConfig.provider,
    providerConfig.providerOptions,
    reasoning,
  )
  const temperature = providerConfig.temperature
  const abortController = new AbortController()
  registerAbortController(abortController)

  const throwIfAborted = () => {
    if (abortController.signal.aborted) {
      throw new DOMException("aborted", "AbortError")
    }
  }

  const webPageContext = await getSelectionWebPagePromptContext(
    { kind: "local", config: providerConfig },
    translateRequest.enableAIContentAware,
  )
  throwIfAborted()

  const { systemPrompt, prompt } = getTranslatePromptFromConfig(
    { customPromptsConfig: translateRequest.customPromptsConfig },
    targetLangName,
    preparedText,
    {
      ...(webPageContext
        ? {
            context: {
              webTitle: webPageContext.webTitle,
              webDescription: webPageContext.webDescription,
              webContent: webPageContext.webContent,
              webSummary: webPageContext.webSummary,
            },
          }
        : {}),
    },
  )

  const translatedText = await streamBackgroundText(
    {
      providerKind: "local",
      providerId,
      instructions: systemPrompt,
      prompt,
      providerOptions,
      reasoning,
      temperature,
    },
    {
      signal: abortController.signal,
      onChunk,
    },
  )

  return translatedText
}

async function translateWithHostedTextStream({
  preparedText,
  provider,
  translateRequest,
  onChunk,
  registerAbortController,
}: {
  preparedText: string
  provider: SystemProviderRef
  translateRequest: SelectionToolbarTranslateRequestSlice
  onChunk: (data: BackgroundTextStreamSnapshot) => void
  registerAbortController: (abortController: AbortController) => void
}) {
  const targetLangName = LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode]
  const abortController = new AbortController()
  registerAbortController(abortController)

  // Smart context on hosted runs mirrors the BYOK LLM path: the summary is
  // generated (and cached per page + provider) on the same Built-in AI
  // provider. Fail soft — a summary the tier cannot fund degrades to raw
  // context instead of blocking the translation, whose own stream surfaces
  // the real error.
  let summaryProviderRef: PromptableProviderRef | null = null
  if (translateRequest.enableAIContentAware) {
    const availability = await checkProviderAvailability(provider, "selectionTranslation")
    summaryProviderRef = availability.available ? availability.providerRef : null
  }
  const webPageContext = await getSelectionWebPagePromptContext(
    summaryProviderRef,
    translateRequest.enableAIContentAware,
  )
  if (abortController.signal.aborted) {
    throw new DOMException("aborted", "AbortError")
  }

  const { systemPrompt, prompt } = getTranslatePromptFromConfig(
    { customPromptsConfig: translateRequest.customPromptsConfig },
    targetLangName,
    preparedText,
    {
      ...(webPageContext
        ? {
            context: {
              webTitle: webPageContext.webTitle,
              webDescription: webPageContext.webDescription,
              webContent: webPageContext.webContent,
              webSummary: webPageContext.webSummary,
            },
          }
        : {}),
    },
  )

  return streamBackgroundText(
    {
      providerKind: "system",
      providerId: provider.id,
      modelTier: provider.modelTier,
      requestId: getRandomUUID(),
      hostedFeature: "selectionTranslation",
      instructions: systemPrompt,
      prompt,
    },
    {
      signal: abortController.signal,
      onChunk,
    },
  )
}

async function translateWithStandardProvider({
  text,
  provider,
  translateRequest,
}: {
  text: string
  provider: ResolvedProviderRef<TranslateProviderConfig>
  translateRequest: SelectionToolbarTranslateRequestSlice
}) {
  // This path is reached only for pure translate providers (the dispatch sends
  // system refs to the hosted stream and local LLMs to the text stream), and
  // those take no prompt — requesting a summary for them was a doomed queue
  // task that could never generate text.
  const webPageContext = await getSelectionWebPagePromptContext(
    null,
    translateRequest.enableAIContentAware,
  )
  const translatedText = await translateTextCore({
    text,
    langConfig: translateRequest.language,
    providerConfig: provider,
    hostedFeature: "selectionTranslation",
    enableAIContentAware: translateRequest.enableAIContentAware,
    extraHashTags: ["selectionTranslation"],
    webPageContext,
  })

  return translatedText
}

/**
 * Keeps the hosted-status hook inside SelectionPopover.Content, which stays
 * unmounted until the popover first opens — the selection app mounts on every
 * page, and merely loading a page must not fire hosted-AI session/status
 * requests. Mirrors CustomActionFooterContent.
 */
function TranslateFooterContent({
  providers,
  ...props
}: ComponentProps<typeof SelectionToolbarFooterContent>) {
  const translateProviders = useHostedAiProviderOptions("selectionTranslation", providers)
  return <SelectionToolbarFooterContent providers={translateProviders} {...props} />
}

interface SelectionTranslationContextValue {
  prepareToolbarOpen: () => void
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
  const titleText = document.title || null
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

    setActiveSession(pendingRequest?.session ?? selectionSession)
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

      setIsTranslating(true)
      setTranslatedText(undefined)
      setThinking(null)
      setError(null)

      const provider = translateRequest.provider
      if (!provider) {
        if (runIdRef.current === runId) {
          setIsTranslating(false)
          setError(createSelectionToolbarPrecheckError("translate", "providerUnavailable"))
        }
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          outcome: "failure",
        })
        return
      }

      if (provider.kind === "local" && !provider.config.enabled) {
        if (runIdRef.current === runId) {
          setIsTranslating(false)
          setError(createSelectionToolbarPrecheckError("translate", "providerDisabled"))
        }
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          outcome: "failure",
        })
        return
      }

      try {
        let nextTranslatedText = ""
        if (provider.kind === "system") {
          setThinking({
            status: "thinking",
            text: "",
          })

          const nextSnapshot = await translateWithHostedTextStream({
            preparedText,
            provider,
            translateRequest,
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

          nextTranslatedText = nextSnapshot.output
          if (runIdRef.current === runId) {
            setThinking(nextSnapshot.thinking)
          }
        } else if (!isTranslateProviderConfig(provider.config)) {
          if (runIdRef.current === runId) {
            setIsTranslating(false)
            setError(createSelectionToolbarPrecheckError("translate", "providerUnavailable"))
          }
          void trackFeatureUsed({
            ...analyticsContext,
            ...providerAnalytics,
            outcome: "failure",
          })
          return
        } else if (isLLMProviderConfig(provider.config)) {
          const providerConfig = provider.config
          setThinking({
            status: "thinking",
            text: "",
          })

          const nextSnapshot = await translateWithTextStream({
            preparedText,
            providerId: providerConfig.id,
            providerConfig,
            translateRequest,
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

          nextTranslatedText = nextSnapshot.output
          if (runIdRef.current === runId) {
            setThinking(nextSnapshot.thinking)
          }
        } else {
          setThinking(null)
          nextTranslatedText = await translateWithStandardProvider({
            text: preparedText,
            provider,
            translateRequest,
          })
        }

        if (runIdRef.current === runId) {
          setTranslatedText(nextTranslatedText)
        }

        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
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
            outcome: "failure",
          })
        }
      } finally {
        if (runIdRef.current === runId) {
          abortControllerRef.current = null
          setIsTranslating(false)
        }
      }
    },
    [resetTranslationState, selectionText, sourceSurface, translateRequest],
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

  const resolveShortcutRequest = useCallback((): SelectionTranslatePendingOpenRequest | null => {
    const request = resolveShortcutOpenRequest()
    if (!request) {
      return null
    }

    return {
      anchor: request.anchor,
      session: request.session,
      surface: ANALYTICS_SURFACE.SHORTCUT,
    }
  }, [resolveShortcutOpenRequest])

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

  const openFromContextMenu = useCallback(() => {
    openSelectionTranslationRequest(resolveContextMenuRequest(), {
      showMissingSelectionToast: true,
    })
  }, [openSelectionTranslationRequest, resolveContextMenuRequest])

  const openFromShortcut = useCallback(() => {
    openSelectionTranslationRequest(resolveShortcutRequest())
  }, [openSelectionTranslationRequest, resolveShortcutRequest])

  useEffect(() => {
    const shortcut = selectionToolbar.features.translate.shortcut
    if (
      isPageTranslationShortcutEmpty(shortcut) ||
      !isValidConfiguredPageTranslationShortcut(shortcut)
    ) {
      return undefined
    }

    const registration = HotkeyManager.getInstance().register(
      shortcut as Hotkey,
      () => {
        openFromShortcut()
      },
      {
        ignoreInputs: true,
        preventDefault: true,
        stopPropagation: true,
      },
    )

    return () => {
      registration.unregister()
    }
  }, [openFromShortcut, selectionToolbar.features.translate.shortcut])

  useEffect(() => {
    return onMessage("openSelectionTranslationFromContextMenu", () => {
      openFromContextMenu()
    })
  }, [openFromContextMenu])

  const contextValue = useMemo<SelectionTranslationContextValue>(
    () => ({
      prepareToolbarOpen,
    }),
    [prepareToolbarOpen],
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
          <TranslateFooterContent
            paragraphsText={paragraphsText}
            providers={translateProviders}
            titleText={titleText}
            value={translateRequest.provider?.id ?? ""}
            onProviderChange={handleProviderChange}
            onRegenerate={handleRegenerate}
          />
        </SelectionPopover.Content>
      </SelectionPopover.Root>
    </SelectionTranslationContext>
  )
}
