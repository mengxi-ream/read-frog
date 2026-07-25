import type { Hotkey } from "@tanstack/hotkeys"
import type { ReactNode } from "react"
import type { SelectionSession, SelectionToolbarTranslateRequestSlice } from "../atoms"
import type { SelectionToolbarInlineError } from "../inline-error"
import type { TranslationActionContext } from "@/types/analytics"
import type { BackgroundTextStreamSnapshot, ThinkingSnapshot } from "@/types/background-stream"
import type { LLMProviderConfig, ProviderConfig } from "@/types/config/provider"
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
import { toastManager } from "@/components/ui/base-ui/toast"
import { SelectionPopover } from "@/components/ui/selection-popover"
import {
  ANALYTICS_FEATURE,
  ANALYTICS_SURFACE,
  TRANSLATION_REQUESTED_FEATURE,
} from "@/types/analytics"
import { isLLMProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import {
  classifyTranslationRequest,
  createFeatureUsageContext,
  trackFeatureUsed,
  trackTranslationRequested,
} from "@/utils/analytics"
import { classifyProviderConfig } from "@/utils/analytics-provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { translateTextCore } from "@/utils/host/translate/translate-text"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { getOrGenerateWebPageSummary } from "@/utils/host/translate/webpage-summary"
import { onMessage, sendMessage } from "@/utils/message"
import {
  isPageTranslationShortcutEmpty,
  isValidConfiguredPageTranslationShortcut,
} from "@/utils/page-translation-shortcut"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { resolveModelId } from "@/utils/providers/model-id"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { getTopLevelReasoning } from "@/utils/providers/reasoning"
import { shadowWrapper } from "../.."
import { SelectionToolbarErrorAlert } from "../../components/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "../../components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "../../components/selection-toolbar-title-content"
import {
  isSelectionToolbarVisibleAtom,
  selectionSessionAtom,
  selectionToolbarTranslateRequestAtom,
} from "../atoms"
import { isSaveToNotebaseDialogOpenAtom } from "../custom-action-button/save-to-notebase-dialog-atom"
import {
  createSelectionToolbarPrecheckError,
  createSelectionToolbarRuntimeError,
  isAbortError,
} from "../inline-error"
import { SaveSuggestionCard } from "../save-suggestion/save-suggestion-card"
import { useSaveSuggestion } from "../save-suggestion/use-save-suggestion"
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

async function getSelectionWebPagePromptContext(
  providerConfig: ProviderConfig,
  enableAIContentAware: boolean,
) {
  const webPageContext = await getOrCreateWebPageContext()
  if (!webPageContext) {
    return undefined
  }

  const webSummary = await getOrGenerateWebPageSummary(
    webPageContext,
    providerConfig,
    enableAIContentAware,
  )
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
  actionContext,
}: {
  preparedText: string
  providerId: string
  providerConfig: LLMProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
  onChunk: (data: BackgroundTextStreamSnapshot) => void
  registerAbortController: (abortController: AbortController) => void
  actionContext: TranslationActionContext
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
    providerConfig,
    translateRequest.enableAIContentAware,
  )
  throwIfAborted()
  const configuredPrompt =
    translateRequest.customPromptsConfig.promptId === null ? "default" : "custom"
  const promptExperimentVariant =
    (await sendMessage("resolvePromptExperimentVariant", { configuredPrompt })) ?? undefined
  throwIfAborted()

  let { systemPrompt, prompt } = getTranslatePromptFromConfig(
    { customPromptsConfig: translateRequest.customPromptsConfig },
    targetLangName,
    preparedText,
    {
      promptExperimentVariant,
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

  if (promptExperimentVariant) {
    const exposed = await sendMessage("exposePromptExperiment", {
      actionContext,
      expectedVariant: promptExperimentVariant,
    })
    throwIfAborted()
    if (!exposed) {
      ;({ systemPrompt, prompt } = getTranslatePromptFromConfig(
        { customPromptsConfig: translateRequest.customPromptsConfig },
        targetLangName,
        preparedText,
        webPageContext
          ? {
              context: {
                webTitle: webPageContext.webTitle,
                webDescription: webPageContext.webDescription,
                webContent: webPageContext.webContent,
                webSummary: webPageContext.webSummary,
              },
            }
          : undefined,
      ))
    }
  }

  const translatedText = await streamBackgroundText(
    {
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

async function translateWithStandardProvider({
  text,
  providerConfig,
  translateRequest,
}: {
  text: string
  providerConfig: ProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
}) {
  const webPageContext = await getSelectionWebPagePromptContext(
    providerConfig,
    translateRequest.enableAIContentAware,
  )
  const translatedText = await translateTextCore({
    text,
    langConfig: translateRequest.language,
    providerConfig,
    enableAIContentAware: translateRequest.enableAIContentAware,
    extraHashTags: ["selectionTranslation"],
    webPageContext,
  })

  return translatedText
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
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pendingOpenRequestRef = useRef<SelectionTranslatePendingOpenRequest | null>(null)
  const reopenFrameRef = useRef<number | null>(null)
  const lastTranslationRunKeyRef = useRef<string | null>(null)
  const runIdRef = useRef(0)
  const { resolveContextMenuOpenRequest, resolveShortcutOpenRequest } =
    useSelectionOpenRequestResolver(selectionSession)
  const selectionText = activeSession?.selectionSnapshot.text ?? null
  const paragraphsText = activeSession?.contextSnapshot.text ?? selectionText
  const titleText = document.title || null
  const translateProviders = useMemo(
    () => getSelectableProvidersForCapability("selectionToolbar.translate", providersConfig),
    [providersConfig],
  )
  const translateRequestKey = useMemo(() => JSON.stringify(translateRequest), [translateRequest])
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const {
    suggestion: saveSuggestion,
    maybeFire: maybeFireSaveSuggestion,
    cancel: cancelSaveSuggestion,
    resetSession: resetSaveSuggestionSession,
    markShownOnce: markSaveSuggestionShownOnce,
  } = useSaveSuggestion()

  // Suggestion identity must change whenever a translation re-run would produce
  // different notes (target language / provider change bumps translateRequestKey;
  // regenerate bumps rerunNonce). Keying only on popoverSessionKey would leave a
  // stale old-language suggestion rendered after the new translation.
  const saveSuggestionSessionKey = `${popoverSessionKey}:${translateRequestKey}:${rerunNonce}`

  const fireSaveSuggestion = useEffectEvent((preparedText: string) => {
    maybeFireSaveSuggestion({
      sessionKey: saveSuggestionSessionKey,
      selectionText: preparedText,
      paragraphsText: paragraphsText ?? preparedText,
      targetLangName: LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode],
      webTitle: titleText ?? "",
    })
  })

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
      cancelSaveSuggestion()
    },
    [cancelSaveSuggestion],
  )

  const commitOpenRequest = useCallback((request: SelectionTranslatePendingOpenRequest) => {
    pendingOpenRequestRef.current = request
    if (request.anchor) {
      setAnchor(request.anchor)
    }
  }, [])

  const handleProviderChange = useCallback(
    (providerId: string) => {
      void setConfig(buildFeatureProviderPatch({ "selectionToolbar.translate": providerId }))
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
      const actionContext: TranslationActionContext = {
        actionId: `selection-${activeSession?.id ?? "unknown"}-${runId}`,
        feature: TRANSLATION_REQUESTED_FEATURE.SELECTION_TRANSLATION,
        surface: sourceSurface,
      }

      const requestedProvider =
        translateRequest.provider?.kind === "local" ? translateRequest.provider.config : null
      const providerAnalytics = classifyProviderConfig(requestedProvider)
      const translationRequestedPromise = trackTranslationRequested({
        feature: TRANSLATION_REQUESTED_FEATURE.SELECTION_TRANSLATION,
        surface: sourceSurface,
        ...classifyTranslationRequest(
          requestedProvider,
          translateRequest.customPromptsConfig.promptId,
        ),
      })

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
        if (provider.kind !== "local") {
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

        const providerConfig = provider.config
        if (!isTranslateProviderConfig(providerConfig)) {
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

        let nextTranslatedText = ""
        if (isLLMProviderConfig(providerConfig)) {
          await translationRequestedPromise
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
            actionContext,
          })

          nextTranslatedText = nextSnapshot.output
          if (runIdRef.current === runId) {
            setThinking(nextSnapshot.thinking)
          }
        } else {
          setThinking(null)
          nextTranslatedText = await translateWithStandardProvider({
            text: preparedText,
            providerConfig,
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
        void Promise.resolve(
          sendMessage("clearPromptExperimentAction", {
            actionId: actionContext.actionId,
          }),
        ).catch(() => undefined)
        if (runIdRef.current === runId) {
          abortControllerRef.current = null
          setIsTranslating(false)
        }
      }
    },
    [activeSession?.id, resetTranslationState, selectionText, sourceSurface, translateRequest],
  )

  const startTranslation = useEffectEvent((runId: number) => {
    // Kick off the save suggestion together with a translation run that will
    // actually start (mirrors runTranslation's prechecks so a run that only
    // surfaces an error never spends hosted-AI quota). Its card renders only
    // after the translation stream finishes.
    const preparedText = prepareTranslationText(selectionText)
    const provider = translateRequest.provider
    if (
      preparedText !== "" &&
      provider?.kind === "local" &&
      provider.config.enabled &&
      isTranslateProviderConfig(provider.config)
    ) {
      fireSaveSuggestion(preparedText)
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
        const pendingRequest = pendingOpenRequestRef.current
        const nextSession = pendingRequest?.session ?? selectionSession

        setActiveSession(nextSession)
        setSourceSurface(pendingRequest?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR)
        setPopoverSessionKey((prev) => prev + 1)
        if (pendingRequest?.anchor) {
          setAnchor(pendingRequest.anchor)
        }
        setIsSelectionToolbarVisible(false)
        pendingOpenRequestRef.current = null
      } else {
        resetPopoverSession({
          clearAnchor: pendingOpenRequestRef.current === null,
        })
        lastTranslationRunKeyRef.current = null
        resetSaveSuggestionSession()
      }

      setIsOpen(nextOpen)
    },
    [
      cancelCurrentTranslation,
      resetPopoverSession,
      resetSaveSuggestionSession,
      resetTranslationState,
      selectionSession,
      setIsSelectionToolbarVisible,
    ],
  )

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

      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current)
        reopenFrameRef.current = null
      }

      if (isOpen) {
        handleOpenChange(false)
        reopenFrameRef.current = requestAnimationFrame(() => {
          reopenFrameRef.current = null
          commitOpenRequest(request)
          handleOpenChange(true)
        })
        return
      }

      commitOpenRequest(request)
      handleOpenChange(true)
    },
    [commitOpenRequest, handleOpenChange, isOpen],
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

  useEffect(() => {
    return () => {
      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current)
      }
    }
  }, [])

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

          <SelectionPopover.Body>
            <TranslationContent
              selectionContent={selectionText}
              translatedText={translatedText}
              isTranslating={isTranslating}
              thinking={thinking}
            />
            {!isTranslating &&
              !!translatedText &&
              !error &&
              saveSuggestion?.sessionKey === saveSuggestionSessionKey && (
                <SaveSuggestionCard
                  suggestion={saveSuggestion}
                  markShownOnce={markSaveSuggestionShownOnce}
                />
              )}
            <SelectionToolbarErrorAlert error={error} className="-mt-3" />
          </SelectionPopover.Body>
          <SelectionToolbarFooterContent
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
