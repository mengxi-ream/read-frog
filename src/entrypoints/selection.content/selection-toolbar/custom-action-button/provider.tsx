import type { ReactNode } from "react"
import type { SelectionSession } from "../atoms"
import { useAtomValue, useSetAtom } from "jotai"
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { isLLMProviderConfig } from "@/types/config/provider"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig, getProviderConfigById } from "@/utils/config/helpers"
import { onMessage } from "@/utils/message"
import { shadowWrapper } from "../.."
import { SelectionToolbarErrorAlert } from "../../components/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "../../components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "../../components/selection-toolbar-title-content"
import { normalizeSelectedText } from "../../utils"
import {
  contextAtom,
  isSelectionToolbarVisibleAtom,
  selectionAtom,
  selectionSessionAtom,
} from "../atoms"
import { createSelectionToolbarPrecheckError } from "../inline-error"
import { useSelectionContextMenuRequestResolver } from "../use-selection-context-menu-request"
import { CustomActionContent } from "./custom-action-content"
import { SaveToNotebaseButton } from "./save-to-notebase-button"
import {
  buildCustomActionExecutionPlan,
  useCustomActionExecution,
} from "./use-custom-action-execution"

interface SelectionCustomActionPendingOpenRequest {
  actionId: string
  anchor?: { x: number, y: number }
  session: SelectionSession | null
  surface: typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR | typeof ANALYTICS_SURFACE.CONTEXT_MENU
}

interface SelectionCustomActionContextValue {
  openToolbarCustomAction: (actionId: string, triggerElement: HTMLElement | null) => void
}

const SelectionCustomActionContext = createContext<SelectionCustomActionContextValue | null>(null)

function useSelectionCustomActionContext() {
  const context = use(SelectionCustomActionContext)
  if (!context) {
    throw new Error("Selection custom action triggers must be used within SelectionCustomActionProvider.")
  }

  return context
}

export function useSelectionCustomActionPopover() {
  return useSelectionCustomActionContext()
}

export function SelectionCustomActionProvider({
  children,
}: {
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number, y: number } | null>(null)
  const [popoverSessionKey, setPopoverSessionKey] = useState(0)
  const [rerunNonce, setRerunNonce] = useState(0)
  const [activeSession, setActiveSession] = useState<SelectionSession | null>(null)
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [sourceSurface, setSourceSurface] = useState<
    typeof ANALYTICS_SURFACE.SELECTION_TOOLBAR | typeof ANALYTICS_SURFACE.CONTEXT_MENU
  >(ANALYTICS_SURFACE.SELECTION_TOOLBAR)
  const selectionSession = useAtomValue(selectionSessionAtom)
  const selection = useAtomValue(selectionAtom)
  const context = useAtomValue(contextAtom)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const language = useAtomValue(configFieldsAtomMap.language)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const bodyRef = useRef<HTMLDivElement>(null)
  const pendingOpenRequestRef = useRef<SelectionCustomActionPendingOpenRequest | null>(null)
  const reopenFrameRef = useRef<number | null>(null)
  const nextEphemeralSessionIdRef = useRef(0)
  const trackedPrecheckErrorKeyRef = useRef<string | null>(null)
  const { resolveContextMenuSelectionRequest } = useSelectionContextMenuRequestResolver(selectionSession)
  const selectionText = activeSession?.selectionSnapshot.text ?? null
  const cleanSelection = useMemo(
    () => normalizeSelectedText(selectionText),
    [selectionText],
  )
  const paragraphsText = useMemo(() => {
    if (!cleanSelection) {
      return ""
    }

    return activeSession?.contextSnapshot.text || cleanSelection
  }, [activeSession?.contextSnapshot.text, cleanSelection])
  const titleText = document.title || null
  const activeAction = useMemo(
    () => selectionToolbarConfig.customActions.find(action =>
      action.enabled !== false && action.id === activeActionId,
    ) ?? null,
    [activeActionId, selectionToolbarConfig.customActions],
  )
  const customActionRequest = useMemo(() => ({
    language,
    action: activeAction,
    providerConfig: activeAction
      ? getProviderConfigById(providersConfig, activeAction.providerId) ?? null
      : null,
  }), [activeAction, language, providersConfig])
  const llmProviders = useMemo(
    () => filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig),
    [providersConfig],
  )
  const executionPlan = useMemo(
    () => buildCustomActionExecutionPlan(customActionRequest, cleanSelection, paragraphsText),
    [cleanSelection, customActionRequest, paragraphsText],
  )
  const {
    error,
    isRunning,
    resetSessionState,
    result,
    thinking,
  } = useCustomActionExecution({
    bodyRef,
    analyticsSurface: sourceSurface,
    executionContext: executionPlan.executionContext,
    open: isOpen,
    popoverSessionKey,
    rerunNonce,
  })
  const displayedResult = executionPlan.executionContext ? result : null
  const displayedError = error ?? executionPlan.error
  const displayedIsRunning = executionPlan.executionContext ? isRunning : false
  const displayedThinking = executionPlan.executionContext ? thinking : null

  const resetPopoverSession = useCallback((options?: { clearAnchor?: boolean }) => {
    setActiveSession(null)
    setActiveActionId(null)
    if (options?.clearAnchor) {
      setAnchor(null)
    }
  }, [])

  const commitOpenRequest = useCallback((request: SelectionCustomActionPendingOpenRequest) => {
    pendingOpenRequestRef.current = request
    if (request.anchor) {
      setAnchor(request.anchor)
    }
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    resetSessionState()

    if (nextOpen) {
      const pendingRequest = pendingOpenRequestRef.current
      const nextSession = pendingRequest?.session ?? selectionSession

      setActiveSession(nextSession)
      setActiveActionId(pendingRequest?.actionId ?? null)
      setSourceSurface(pendingRequest?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR)
      setPopoverSessionKey(prev => prev + 1)
      if (pendingRequest?.anchor) {
        setAnchor(pendingRequest.anchor)
      }
      setIsSelectionToolbarVisible(false)
      pendingOpenRequestRef.current = null
    }
    else {
      resetPopoverSession({
        clearAnchor: pendingOpenRequestRef.current === null,
      })
    }

    setIsOpen(nextOpen)
  }, [resetPopoverSession, resetSessionState, selectionSession, setIsSelectionToolbarVisible])

  const openActionRequest = useCallback((request: SelectionCustomActionPendingOpenRequest) => {
    if (isOpen) {
      handleOpenChange(false)

      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current)
      }

      reopenFrameRef.current = requestAnimationFrame(() => {
        reopenFrameRef.current = null
        commitOpenRequest(request)
        handleOpenChange(true)
      })
      return
    }

    commitOpenRequest(request)
    handleOpenChange(true)
  }, [commitOpenRequest, handleOpenChange, isOpen])

  const openToolbarCustomAction = useCallback((actionId: string, triggerElement: HTMLElement | null) => {
    if (!triggerElement) {
      return
    }

    const rect = triggerElement.getBoundingClientRect()
    openActionRequest({
      actionId,
      anchor: { x: rect.left, y: rect.top },
      surface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
      session: selectionSession ?? (selection
        ? {
            id: --nextEphemeralSessionIdRef.current,
            createdAt: Date.now(),
            selectionSnapshot: selection,
            contextSnapshot: context ?? {
              text: "",
              paragraphs: [],
            },
          }
        : null),
    })
  }, [context, openActionRequest, selection, selectionSession])

  const openContextMenuCustomAction = useCallback((actionId: string) => {
    const action = selectionToolbarConfig.customActions.find(candidate =>
      candidate.enabled !== false && candidate.id === actionId,
    )
    if (!action) {
      const nextError = createSelectionToolbarPrecheckError("customAction", "actionUnavailable")
      void trackFeatureUsed({
        ...createFeatureUsageContext(
          ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
          ANALYTICS_SURFACE.CONTEXT_MENU,
          Date.now(),
          {
            action_id: actionId,
          },
        ),
        outcome: "failure",
      })
      toast.error(nextError.description)
      return
    }

    const request = resolveContextMenuSelectionRequest()
    if (!request) {
      const nextError = createSelectionToolbarPrecheckError("customAction", "missingSelection")
      void trackFeatureUsed({
        ...createFeatureUsageContext(
          ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
          ANALYTICS_SURFACE.CONTEXT_MENU,
          Date.now(),
          {
            action_id: action.id,
            action_name: action.name,
          },
        ),
        outcome: "failure",
      })
      toast.error(nextError.description)
      return
    }

    openActionRequest({
      actionId: action.id,
      anchor: request.anchor,
      session: request.session,
      surface: ANALYTICS_SURFACE.CONTEXT_MENU,
    })
  }, [openActionRequest, resolveContextMenuSelectionRequest, selectionToolbarConfig.customActions])

  const handleProviderChange = useCallback((providerId: string) => {
    if (!activeActionId) {
      return
    }

    const updatedCustomActions = selectionToolbarConfig.customActions.map(action =>
      action.id === activeActionId
        ? { ...action, providerId }
        : action,
    )

    void setConfig({
      selectionToolbar: {
        ...selectionToolbarConfig,
        customActions: updatedCustomActions,
      },
    })
  }, [activeActionId, selectionToolbarConfig, setConfig])

  const handleRegenerate = useCallback(() => {
    setRerunNonce(prev => prev + 1)
  }, [])

  useEffect(() => {
    return onMessage("openSelectionCustomActionFromContextMenu", (message) => {
      openContextMenuCustomAction(message.data.actionId)
    })
  }, [openContextMenuCustomAction])

  useEffect(() => {
    return () => {
      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !executionPlan.error || executionPlan.executionContext) {
      return
    }

    const analyticsContext = createFeatureUsageContext(
      ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
      sourceSurface,
      Date.now(),
      {
        action_id: activeActionId ?? undefined,
        action_name: activeAction?.name,
      },
    )
    const nextErrorKey = JSON.stringify({
      actionId: analyticsContext.action_id ?? null,
      description: executionPlan.error.description,
      popoverSessionKey,
      surface: sourceSurface,
    })

    if (trackedPrecheckErrorKeyRef.current === nextErrorKey) {
      return
    }
    trackedPrecheckErrorKeyRef.current = nextErrorKey

    void trackFeatureUsed({
      ...analyticsContext,
      outcome: "failure",
    })
  }, [
    activeAction?.name,
    activeActionId,
    executionPlan.error,
    executionPlan.executionContext,
    isOpen,
    popoverSessionKey,
    sourceSurface,
  ])

  const contextValue = useMemo<SelectionCustomActionContextValue>(() => ({
    openToolbarCustomAction,
  }), [openToolbarCustomAction])

  return (
    <SelectionCustomActionContext value={contextValue}>
      {children}
      <SelectionPopover.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        anchor={anchor}
        onAnchorChange={setAnchor}
      >
        <SelectionPopover.Content key={popoverSessionKey} container={shadowWrapper ?? document.body}>
          <SelectionPopover.Header className="border-b">
            <SelectionToolbarTitleContent
              title={activeAction?.name ?? "Custom Action"}
              icon={activeAction?.icon ?? "tabler:sparkles"}
            />
            <div className="flex items-center gap-1">
              <SelectionPopover.Pin />
              <SelectionPopover.Close />
            </div>
          </SelectionPopover.Header>

          <SelectionPopover.Body ref={bodyRef}>
            <CustomActionContent
              isRunning={displayedIsRunning}
              outputSchema={activeAction?.outputSchema ?? []}
              selectionContent={selectionText}
              value={displayedResult}
              thinking={displayedThinking}
            />
            <SelectionToolbarErrorAlert error={displayedError} />
          </SelectionPopover.Body>
          <SelectionToolbarFooterContent
            paragraphsText={paragraphsText}
            providers={llmProviders}
            titleText={titleText}
            value={customActionRequest.providerConfig?.id ?? ""}
            onProviderChange={handleProviderChange}
            onRegenerate={handleRegenerate}
          >
            {activeAction && (
              <SaveToNotebaseButton
                action={activeAction}
                isRunning={displayedIsRunning}
                result={displayedResult}
              />
            )}
          </SelectionToolbarFooterContent>
        </SelectionPopover.Content>
      </SelectionPopover.Root>
    </SelectionCustomActionContext>
  )
}
