import type { CustomActionRequest } from "./atoms"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { CustomActionProviderRef } from "@/utils/providers/provider-registry"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useMemo, useRef } from "react"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { ReviewDueTab } from "@/components/ui/selection-popover/review-due-tab"
import { SelectionToolbarErrorAlert } from "@/components/ui/selection-popover/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "@/components/ui/selection-popover/selection-toolbar-footer-content"
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

export function CustomActionPanel() {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [request, setRequest] = useAtom(customActionRequestAtom)
  const language = useAtomValue(configFieldsAtomMap.language)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const trackedFailureKeyRef = useRef<string | null>(null)
  const open = request !== null
  const actionId = request?.actionId ?? null
  const selectionText = request?.selectionText ?? ""

  const action = useMemo(() => {
    if (!actionId) {
      return null
    }
    const found = findSelectionToolbarAction(selectionToolbarConfig, actionId)
    return found && found.enabled !== false ? found : null
  }, [actionId, selectionToolbarConfig])
  const provider = useMemo(
    () =>
      action
        ? resolveProviderRefForCapability("customAction", providersConfig, action.providerId)
        : null,
    [action, providersConfig],
  )
  const providers = useMemo(
    () => getSelectableProvidersForCapability("customAction", providersConfig),
    [providersConfig],
  )

  const webPageContext = useCustomActionWebPageContext(open, request?.sessionKey ?? 0)
  const executionPlan = useMemo(
    () =>
      buildCustomActionExecutionPlan(
        { language, action, provider },
        selectionText,
        request?.contextText ?? "",
        webPageContext,
      ),
    [action, language, provider, request?.contextText, selectionText, webPageContext],
  )
  const { executionContext } = executionPlan
  const execution = useCustomActionExecution({
    bodyRef,
    analyticsSurface: request?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR,
    executionContext,
    open,
    popoverSessionKey: request?.sessionKey ?? 0,
    rerunNonce: request?.rerunNonce ?? 0,
  })
  const precheckError = executionContext ? null : executionPlan.error

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

  const changeProvider = (providerId: string) => {
    void setConfig({
      selectionToolbar: patchSelectionToolbarAction(selectionToolbarConfig, request.actionId, {
        providerId,
      }),
    })
  }
  const regenerate = () => setRequest({ ...request, rerunNonce: request.rerunNonce + 1 })

  const result = executionContext ? execution.result : null
  const error = execution.error ?? executionPlan.error
  const isRunning = webPageContext === undefined || (executionContext ? execution.isRunning : false)
  const status = isRunning ? "streaming" : error ? "error" : "done"
  // The layout's ctx mirrors the prompt tokens of the run on screen; before
  // there is one (precheck, page context still loading) it falls back to the
  // same sources those tokens are built from.
  const layoutSelection = executionContext?.promptTokens.selection ?? selectionText
  const layoutTargetCode = executionContext?.targetCode ?? language.targetCode

  return (
    <>
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
      <SelectionPopover.Body key={`${request.sessionKey}:${request.selectionText}`} ref={bodyRef}>
        <CustomActionContent
          action={action}
          status={status}
          selection={layoutSelection}
          targetCode={layoutTargetCode}
          selectionContent={request.selectionText}
          value={result}
          thinking={executionContext ? execution.thinking : null}
          speakSurface={request.surface}
        />
        <SelectionToolbarErrorAlert error={error} />
      </SelectionPopover.Body>
      <ReviewDueTab source="extension_custom_ai_action" />
      <CustomActionPanelFooter
        action={action}
        provider={provider}
        providers={providers}
        contextText={request.contextText}
        titleText={(webPageContext?.webTitle ?? getSourceDocumentTitle()) || null}
        isRunning={isRunning}
        result={result}
        surface={request.surface}
        onProviderChange={changeProvider}
        onRegenerate={regenerate}
      />
    </>
  )
}

/**
 * Keeps the hosted-status hook inside SelectionPopover.Content, which stays
 * unmounted until the popover first opens — the selection app mounts on every
 * page, and merely loading a page must not fire hosted-AI session/status
 * requests.
 */
function CustomActionPanelFooter({
  action,
  provider,
  providers,
  contextText,
  titleText,
  isRunning,
  result,
  surface,
  onProviderChange,
  onRegenerate,
}: {
  action: SelectionToolbarCustomAction | null
  provider: CustomActionProviderRef | null
  providers: ReturnType<typeof getSelectableProvidersForCapability>
  contextText: string
  titleText: string | null
  isRunning: boolean
  result: Record<string, unknown> | null
  surface: CustomActionRequest["surface"]
  onProviderChange: (providerId: string) => void
  onRegenerate: () => void
}) {
  const hostedProviders = useHostedAiProviderOptions("customAction", providers)
  const saveSurface =
    surface === ANALYTICS_SURFACE.VIDEO_SUBTITLES
      ? ANALYTICS_SURFACE.VIDEO_SUBTITLES
      : ANALYTICS_SURFACE.SELECTION_TOOLBAR

  return (
    <SelectionToolbarFooterContent
      paragraphsText={contextText}
      providers={hostedProviders}
      titleText={titleText}
      value={provider?.id ?? ""}
      onProviderChange={onProviderChange}
      onRegenerate={onRegenerate}
    >
      {action && (
        <>
          <SaveToNotebaseButton
            action={action}
            isRunning={isRunning}
            result={result}
            surface={saveSurface}
          />
          <CustomActionToolButton action={action} />
        </>
      )}
    </SelectionToolbarFooterContent>
  )
}
