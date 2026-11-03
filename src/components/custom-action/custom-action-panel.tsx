import type { PrimitiveAtom } from "jotai"
import type { ReactNode } from "react"
import type { CustomActionRequest } from "./atoms"
import type { SaveToNotebaseOutcome } from "./use-save-to-notebase"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { createContext, use, useEffect, useMemo, useRef } from "react"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SelectionToolbarErrorAlert } from "@/components/ui/selection-popover/selection-toolbar-error-alert"
import {
  SelectionToolbarFooterContent,
  SelectionToolbarProviderSelect,
} from "@/components/ui/selection-popover/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "@/components/ui/selection-popover/selection-toolbar-title-content"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { getSourceDocumentTitle } from "@/utils/content/document-title"
import { findSelectionToolbarAction, patchSelectionToolbarAction } from "@/utils/custom-actions"
import {
  getSelectableProvidersForCapability,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"
import { customActionRequestAtom } from "./atoms"
import { CustomActionContent } from "./custom-action-content"
import { CustomActionToolButton } from "./custom-action-tool-button"
import { SaveToNotebaseButton } from "./save-to-notebase-button"
import {
  buildCustomActionExecutionPlan,
  useCustomActionExecution,
  useCustomActionWebPageContext,
} from "./use-custom-action-execution"

// The shared action card, in parts each host puts together:
//
//   <CustomActionPanel.Root>
//     <CustomActionPanel.Header />
//     <CustomActionPanel.Body />
//     <ReviewDueTab source="…" />
//     <CustomActionPanel.Footer>
//       <CustomActionPanel.ProviderSelect />
//     </CustomActionPanel.Footer>
//   </CustomActionPanel.Root>
//
// Root runs the action of `customActionRequestAtom` (or the atom it is given)
// and renders nothing without a request. The footer's left side is the host's: the selection toolbar and
// subtitle words put the provider picker there.

function useCustomActionPanelState(requestAtom: PrimitiveAtom<CustomActionRequest | null>) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [request, setRequest] = useAtom(requestAtom)
  const language = useAtomValue(configFieldsAtomMap.language)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const trackedFailureKeyRef = useRef<string | null>(null)
  const open = request !== null
  const actionId = request?.actionId ?? null
  const cleanSelection = request?.cleanSelection ?? ""

  const action = useMemo(() => {
    const found = actionId && findSelectionToolbarAction(selectionToolbarConfig, actionId)
    return found && found.enabled !== false ? found : null
  }, [actionId, selectionToolbarConfig])
  const provider = useMemo(
    () =>
      action && resolveProviderRefForCapability("customAction", providersConfig, action.providerId),
    [action, providersConfig],
  )
  const providers = useMemo(
    () => getSelectableProvidersForCapability("customAction", providersConfig),
    [providersConfig],
  )

  const webPageContext = useCustomActionWebPageContext(open, request?.sessionKey ?? 0)
  const { executionContext, error: precheckError } = useMemo(
    () =>
      buildCustomActionExecutionPlan(
        { language, action, provider },
        cleanSelection,
        request?.contextText ?? "",
        webPageContext,
      ),
    [action, cleanSelection, language, provider, request?.contextText, webPageContext],
  )
  const execution = useCustomActionExecution({
    bodyRef,
    analyticsSurface: request?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR,
    executionContext,
    open,
    popoverSessionKey: request?.sessionKey ?? 0,
    rerunNonce: request?.rerunNonce ?? 0,
  })

  useEffect(() => {
    if (!request || !precheckError) {
      return
    }

    const failureKey = JSON.stringify({
      actionId: request.actionId,
      description: precheckError.description,
      sessionKey: request.sessionKey,
      surface: request.surface,
    })
    if (trackedFailureKeyRef.current === failureKey) {
      return
    }
    trackedFailureKeyRef.current = failureKey

    void trackFeatureUsed({
      ...createFeatureUsageContext(ANALYTICS_FEATURE.CUSTOM_AI_ACTION, request.surface),
      action_id: request.actionId,
      ...(action ? { action_name: action.name } : {}),
      ...classifyResolvedProvider(provider),
      outcome: "failure",
      failure_reason: "precheck",
    })
  }, [action, precheckError, provider, request])

  if (!request) {
    return null
  }

  const error = execution.error ?? precheckError
  const isRunning = webPageContext === undefined || (executionContext ? execution.isRunning : false)
  return {
    request,
    action,
    providerId: provider?.id ?? "",
    providers,
    bodyRef,
    targetCode: language.targetCode,
    result: executionContext ? execution.result : null,
    thinking: executionContext ? execution.thinking : null,
    error,
    isRunning,
    status: isRunning ? ("streaming" as const) : error ? ("error" as const) : ("done" as const),
    titleText: (webPageContext?.webTitle ?? getSourceDocumentTitle()) || null,
    // Speech and Notebase saves count the card by where it sits: on video
    // subtitles, or by text on a page, however the card was opened.
    cardSurface:
      request.surface === ANALYTICS_SURFACE.VIDEO_SUBTITLES
        ? ANALYTICS_SURFACE.VIDEO_SUBTITLES
        : ANALYTICS_SURFACE.SELECTION_TOOLBAR,
    changeProvider: (providerId: string) => {
      void setConfig({
        selectionToolbar: patchSelectionToolbarAction(selectionToolbarConfig, request.actionId, {
          providerId,
        }),
      })
    },
    regenerate: () => setRequest({ ...request, rerunNonce: request.rerunNonce + 1 }),
  }
}

type CustomActionPanelState = NonNullable<ReturnType<typeof useCustomActionPanelState>>

const PanelContext = createContext<CustomActionPanelState | null>(null)

/** The running action's state, for parts a host adds to the card (inside Root). */
export function useCustomActionPanel(): CustomActionPanelState {
  const state = use(PanelContext)
  if (!state) {
    throw new Error("useCustomActionPanel must be used inside CustomActionPanel.Root")
  }
  return state
}

/** `requestAtom`: where the request comes from, for a card beside the one every host shares. */
function Root({
  children,
  requestAtom = customActionRequestAtom,
}: {
  children: ReactNode
  requestAtom?: PrimitiveAtom<CustomActionRequest | null>
}) {
  const state = useCustomActionPanelState(requestAtom)
  return state && <PanelContext value={state}>{children}</PanelContext>
}

function Header() {
  const { action } = useCustomActionPanel()
  return (
    <SelectionPopover.Header className="border-b">
      <SelectionToolbarTitleContent
        title={action?.name ?? "Custom Action"}
        icon={action?.icon ?? "tabler:sparkles"}
      />
      <div className="flex items-center gap-1">
        <SelectionPopover.Pin />
        <SelectionPopover.Close />
      </div>
    </SelectionPopover.Header>
  )
}

function Body() {
  const { action, bodyRef, cardSurface, error, request, result, status, targetCode, thinking } =
    useCustomActionPanel()
  return (
    <SelectionPopover.Body key={`${request.sessionKey}:${request.selectionText}`} ref={bodyRef}>
      <CustomActionContent
        action={action}
        status={status}
        selection={request.cleanSelection}
        targetCode={targetCode}
        selectionContent={request.selectionText}
        value={result}
        thinking={thinking}
        speakSurface={cardSurface}
      />
      <SelectionToolbarErrorAlert error={error} />
    </SelectionPopover.Body>
  )
}

/** The footer: `children` on the left, the card's own buttons on the right. */
function Footer({
  children,
  onSave,
}: {
  children?: ReactNode
  onSave?: (outcome: SaveToNotebaseOutcome) => void
}) {
  const { action, cardSurface, error, isRunning, regenerate, request, result, titleText } =
    useCustomActionPanel()
  return (
    <SelectionToolbarFooterContent
      start={children}
      paragraphsText={request.contextText}
      titleText={titleText}
      onRegenerate={regenerate}
    >
      {action && (
        <>
          <SaveToNotebaseButton
            action={action}
            failed={!!error}
            isRunning={isRunning}
            result={result}
            surface={cardSurface}
            onSave={onSave}
          />
          <CustomActionToolButton action={action} />
        </>
      )}
    </SelectionToolbarFooterContent>
  )
}

/**
 * Picks the action's provider. The hosted-status hook lives here, inside
 * SelectionPopover.Content, which stays unmounted until the popover first
 * opens — the selection app mounts on every page, and merely loading a page
 * must not fire hosted-AI session/status requests.
 */
function ProviderSelect() {
  const { changeProvider, providerId, providers } = useCustomActionPanel()
  const options: ProviderSelectorOption[] = useHostedAiProviderOptions("customAction", providers)
  return (
    <SelectionToolbarProviderSelect
      providers={options}
      value={providerId}
      onChange={changeProvider}
    />
  )
}

export const CustomActionPanel = { Root, Header, Body, Footer, ProviderSelect }
