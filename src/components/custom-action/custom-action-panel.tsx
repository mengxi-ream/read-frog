import type { ComponentProps } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useRef } from "react"
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

/**
 * Keeps the hosted-status hook inside SelectionPopover.Content, which stays
 * unmounted until the popover first opens — the selection app mounts on every
 * page, and merely loading a page must not fire hosted-AI session/status
 * requests.
 */
function CustomActionFooterContent({
  providers,
  ...props
}: ComponentProps<typeof SelectionToolbarFooterContent>) {
  const customActionProviders = useHostedAiProviderOptions("customAction", providers)
  return <SelectionToolbarFooterContent providers={customActionProviders} {...props} />
}

export function CustomActionPanel() {
  const [request, setRequest] = useAtom(customActionRequestAtom)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const language = useAtomValue(configFieldsAtomMap.language)
  const setConfig = useSetAtom(writeConfigAtom)
  const bodyRef = useRef<HTMLDivElement>(null)
  const trackedPrecheckErrorKeyRef = useRef<string | null>(null)
  const open = request !== null
  const sessionKey = request?.sessionKey ?? 0
  const selectionText = request?.selectionText ?? ""
  const contextText = request?.contextText ?? ""
  const surface = request?.surface ?? ANALYTICS_SURFACE.SELECTION_TOOLBAR
  const webPageContext = useCustomActionWebPageContext(open, sessionKey)
  const titleText = (webPageContext?.webTitle ?? getSourceDocumentTitle()) || null
  const activeAction = useMemo(() => {
    if (!request) {
      return null
    }
    const action = findSelectionToolbarAction(selectionToolbarConfig, request.actionId)
    return action && action.enabled !== false ? action : null
  }, [request, selectionToolbarConfig])
  const customActionRequest = useMemo(
    () => ({
      language,
      action: activeAction,
      provider: activeAction
        ? resolveProviderRefForCapability("customAction", providersConfig, activeAction.providerId)
        : null,
    }),
    [activeAction, language, providersConfig],
  )
  const baseCustomActionProviders = useMemo(
    () => getSelectableProvidersForCapability("customAction", providersConfig),
    [providersConfig],
  )
  const executionPlan = useMemo(
    () =>
      buildCustomActionExecutionPlan(
        customActionRequest,
        selectionText,
        contextText,
        webPageContext,
      ),
    [contextText, customActionRequest, selectionText, webPageContext],
  )
  const { error, isRunning, result, thinking } = useCustomActionExecution({
    bodyRef,
    analyticsSurface: surface,
    executionContext: executionPlan.executionContext,
    open,
    popoverSessionKey: sessionKey,
    rerunNonce: request?.rerunNonce ?? 0,
  })
  const displayedResult = executionPlan.executionContext ? result : null
  const displayedError = error ?? executionPlan.error
  const displayedIsRunning =
    (open && webPageContext === undefined) || (executionPlan.executionContext ? isRunning : false)
  const displayedThinking = executionPlan.executionContext ? thinking : null
  const layoutStatus = displayedIsRunning ? "streaming" : displayedError ? "error" : "done"
  // The layout's ctx mirrors the prompt tokens of the run on screen; before
  // there is one (precheck, page context still loading) it falls back to the
  // same sources those tokens are built from.
  const layoutSelection = executionPlan.executionContext?.promptTokens.selection ?? selectionText
  const layoutTargetCode = executionPlan.executionContext?.targetCode ?? language.targetCode

  const handleProviderChange = useCallback(
    (providerId: string) => {
      if (!request) {
        return
      }

      void setConfig({
        selectionToolbar: patchSelectionToolbarAction(selectionToolbarConfig, request.actionId, {
          providerId,
        }),
      })
    },
    [request, selectionToolbarConfig, setConfig],
  )

  useEffect(() => {
    if (!request || !executionPlan.error || executionPlan.executionContext) {
      return
    }

    const nextErrorKey = JSON.stringify({
      actionId: request.actionId,
      description: executionPlan.error.description,
      sessionKey: request.sessionKey,
      surface: request.surface,
    })

    if (trackedPrecheckErrorKeyRef.current === nextErrorKey) {
      return
    }
    trackedPrecheckErrorKeyRef.current = nextErrorKey

    void trackFeatureUsed({
      ...createFeatureUsageContext(ANALYTICS_FEATURE.CUSTOM_AI_ACTION, request.surface),
      action_id: request.actionId,
      ...(activeAction ? { action_name: activeAction.name } : {}),
      ...classifyResolvedProvider(customActionRequest.provider),
      outcome: "failure",
      failure_reason: "precheck",
    })
  }, [
    activeAction,
    customActionRequest.provider,
    executionPlan.error,
    executionPlan.executionContext,
    request,
  ])

  if (!request) {
    return null
  }

  return (
    <>
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

      <SelectionPopover.Body key={`${request.sessionKey}:${request.selectionText}`} ref={bodyRef}>
        <CustomActionContent
          action={activeAction}
          status={layoutStatus}
          selection={layoutSelection}
          targetCode={layoutTargetCode}
          selectionContent={selectionText}
          value={displayedResult}
          thinking={displayedThinking}
        />
        <SelectionToolbarErrorAlert error={displayedError} />
      </SelectionPopover.Body>
      <ReviewDueTab source="extension_custom_ai_action" />
      <CustomActionFooterContent
        paragraphsText={contextText}
        providers={baseCustomActionProviders}
        titleText={titleText}
        value={customActionRequest.provider?.id ?? ""}
        onProviderChange={handleProviderChange}
        onRegenerate={() => setRequest({ ...request, rerunNonce: request.rerunNonce + 1 })}
      >
        {activeAction && (
          <>
            <SaveToNotebaseButton
              action={activeAction}
              isRunning={displayedIsRunning}
              result={displayedResult}
            />
            <CustomActionToolButton action={activeAction} />
          </>
        )}
      </CustomActionFooterContent>
    </>
  )
}
