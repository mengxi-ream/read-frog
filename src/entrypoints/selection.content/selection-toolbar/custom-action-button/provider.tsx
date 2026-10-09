import type { ReactNode } from "react"
import type { SelectionSession } from "../atoms"
import type { SelectionPopoverActions } from "@/components/ui/selection-popover"
import { useAtomValue, useSetAtom } from "jotai"
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { customActionRequestAtom } from "@/components/custom-action/atoms"
import { CustomActionPanel } from "@/components/custom-action/custom-action-panel"
import { isSaveToNotebaseDialogOpenAtom } from "@/components/custom-action/save-to-notebase-dialog-atom"
import { SaveToNotebaseDialogHost } from "@/components/custom-action/save-to-notebase-dialog-host"
import { toastManager } from "@/components/ui/base-ui/toast"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { createSelectionToolbarPrecheckError } from "@/components/ui/selection-popover/inline-error"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyResolvedProvider, UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { findSelectionToolbarAction } from "@/utils/custom-actions"
import { onMessage } from "@/utils/message"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { normalizeSelectedText } from "../../utils"
import {
  contextAtom,
  isSelectionToolbarOpenAtom,
  selectionAtom,
  selectionSessionAtom,
} from "../atoms"
import { useSelectionOpenRequestResolver } from "../use-selection-open-request"

interface SelectionCustomActionPendingOpenRequest {
  actionId: string
  anchor?: { x: number; y: number }
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
    throw new Error(
      "Selection custom action triggers must be used within SelectionCustomActionProvider.",
    )
  }

  return context
}

export function useSelectionCustomActionPopover() {
  return useSelectionCustomActionContext()
}

export function SelectionCustomActionProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const selectionSession = useAtomValue(selectionSessionAtom)
  const selection = useAtomValue(selectionAtom)
  const context = useAtomValue(contextAtom)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const customActionRequest = useAtomValue(customActionRequestAtom)
  const setCustomActionRequest = useSetAtom(customActionRequestAtom)
  const setIsSelectionToolbarOpen = useSetAtom(isSelectionToolbarOpenAtom)
  const isSaveToNotebaseDialogOpen = useAtomValue(isSaveToNotebaseDialogOpenAtom)
  const shadowWrapper = use(ShadowWrapperContext)
  const pendingOpenRequestRef = useRef<SelectionCustomActionPendingOpenRequest | null>(null)
  const popoverActionsRef = useRef<SelectionPopoverActions | null>(null)
  const nextEphemeralSessionIdRef = useRef(0)
  const sessionKeyRef = useRef(0)
  const { resolveContextMenuOpenRequest } = useSelectionOpenRequestResolver(selectionSession)

  // Anchor application is owned by SelectionPopover.Root (via requestOpen) so
  // a pinned popover reused in place never moves.
  const commitOpenRequest = useCallback((request: SelectionCustomActionPendingOpenRequest) => {
    pendingOpenRequestRef.current = request
  }, [])

  const applyPendingSession = useCallback(
    (mode: "open" | "reuse") => {
      const pendingRequest = pendingOpenRequestRef.current
      const session = pendingRequest?.session ?? selectionSession
      const selectionText = normalizeSelectedText(session?.selectionSnapshot.text)

      if (mode === "open") {
        sessionKeyRef.current += 1
      }

      setCustomActionRequest((previous) =>
        pendingRequest
          ? {
              actionId: pendingRequest.actionId,
              selectionText,
              contextText: selectionText ? session?.contextSnapshot.text || selectionText : "",
              surface: pendingRequest.surface,
              sessionKey: sessionKeyRef.current,
              // A reuse forces a rerun even when the retriggered request
              // resolves to an identical execution key.
              rerunNonce: mode === "reuse" ? (previous?.rerunNonce ?? 0) + 1 : 0,
            }
          : null,
      )
      setIsSelectionToolbarOpen(false)
      pendingOpenRequestRef.current = null
    },
    [selectionSession, setCustomActionRequest, setIsSelectionToolbarOpen],
  )

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        applyPendingSession("open")
      } else {
        setCustomActionRequest(null)
        if (pendingOpenRequestRef.current === null) {
          setAnchor(null)
        }
      }

      setIsOpen(nextOpen)
    },
    [applyPendingSession, setCustomActionRequest],
  )

  // Pinned popovers are reused in place for a new selection or action: the
  // window keeps its position, size, and pin state while the action reruns.
  const handleReuseRequest = useCallback(() => {
    applyPendingSession("reuse")
  }, [applyPendingSession])

  const openActionRequest = useCallback(
    (request: SelectionCustomActionPendingOpenRequest) => {
      commitOpenRequest(request)
      popoverActionsRef.current?.requestOpen(request.anchor ?? null)
    },
    [commitOpenRequest],
  )

  const openToolbarCustomAction = useCallback(
    (actionId: string, triggerElement: HTMLElement | null) => {
      if (!triggerElement) {
        return
      }

      const rect = triggerElement.getBoundingClientRect()
      openActionRequest({
        actionId,
        anchor: { x: rect.left, y: rect.top },
        surface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
        session:
          selectionSession ??
          (selection
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
    },
    [context, openActionRequest, selection, selectionSession],
  )

  const openContextMenuCustomAction = useCallback(
    (actionId: string) => {
      const action = findSelectionToolbarAction(selectionToolbarConfig, actionId)
      if (!action || action.enabled === false) {
        const nextError = createSelectionToolbarPrecheckError("customAction", "actionUnavailable")
        void trackFeatureUsed({
          ...createFeatureUsageContext(
            ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
            ANALYTICS_SURFACE.CONTEXT_MENU,
          ),
          action_id: actionId,
          ...UNKNOWN_FEATURE_PROVIDER,
          outcome: "failure",
          failure_reason: "precheck",
        })
        toastManager.add({ type: "error", title: nextError.description })
        return
      }

      const request = resolveContextMenuOpenRequest()
      if (!request) {
        const nextError = createSelectionToolbarPrecheckError("customAction", "missingSelection")
        void trackFeatureUsed({
          ...createFeatureUsageContext(
            ANALYTICS_FEATURE.CUSTOM_AI_ACTION,
            ANALYTICS_SURFACE.CONTEXT_MENU,
          ),
          action_id: action.id,
          action_name: action.name,
          ...classifyResolvedProvider(
            resolveProviderRefForCapability("customAction", providersConfig, action.providerId),
          ),
          outcome: "failure",
          failure_reason: "precheck",
        })
        toastManager.add({ type: "error", title: nextError.description })
        return
      }

      openActionRequest({
        actionId: action.id,
        anchor: request.anchor,
        session: request.session,
        surface: ANALYTICS_SURFACE.CONTEXT_MENU,
      })
    },
    [openActionRequest, providersConfig, resolveContextMenuOpenRequest, selectionToolbarConfig],
  )

  useEffect(() => {
    return onMessage("openSelectionCustomActionFromContextMenu", (message) => {
      openContextMenuCustomAction(message.data.actionId)
    })
  }, [openContextMenuCustomAction])

  const contextValue = useMemo<SelectionCustomActionContextValue>(
    () => ({
      openToolbarCustomAction,
    }),
    [openToolbarCustomAction],
  )

  return (
    <SelectionCustomActionContext value={contextValue}>
      {children}
      <SelectionPopover.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        anchor={anchor}
        onAnchorChange={setAnchor}
        actionsRef={popoverActionsRef}
        onReuseRequest={handleReuseRequest}
        disablePointerDismissal={isSaveToNotebaseDialogOpen}
      >
        <SelectionPopover.Content
          key={customActionRequest?.sessionKey ?? 0}
          container={shadowWrapper ?? document.body}
        >
          <CustomActionPanel />
        </SelectionPopover.Content>
      </SelectionPopover.Root>
      <SaveToNotebaseDialogHost />
    </SelectionCustomActionContext>
  )
}
