import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useMemo, useRef, useState } from "react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { shadowWrapper } from "../.."
import { SelectionToolbarErrorAlert } from "../../components/selection-toolbar-error-alert"
import { SelectionToolbarFooterContent } from "../../components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "../../components/selection-toolbar-title-content"
import { SelectionToolbarTooltip } from "../../components/selection-tooltip"
import {
  isSelectionToolbarVisibleAtom,
  selectionToolbarCustomActionRequestAtomFamily,
} from "../atoms"
import { useSelectionPopoverSnapshot } from "../use-selection-popover-snapshot"
import { CustomActionContent } from "./custom-action-content"
import { buildCustomActionExecutionPlan, useCustomActionExecution } from "./use-custom-action-execution"

function normalizeSelectedText(value: string | null) {
  return value?.replace(/\u200B/g, "").trim() ?? ""
}

export function SelectionToolbarCustomActionTrigger({ action }: { action: SelectionToolbarCustomAction }) {
  const [open, setOpen] = useState(false)
  const [rerunNonce, setRerunNonce] = useState(0)
  const customActionRequest = useAtomValue(selectionToolbarCustomActionRequestAtomFamily(action.id))
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const bodyRef = useRef<HTMLDivElement>(null)
  const {
    contextSnapshot,
    selectionSnapshot,
    popoverSessionKey,
    captureSelectionSnapshot,
    clearSelectionSnapshot,
  } = useSelectionPopoverSnapshot()
  const selectionText = selectionSnapshot?.text ?? null
  const titleText = document.title || null

  const activeAction = customActionRequest.action
  const cleanSelection = useMemo(
    () => normalizeSelectedText(selectionText),
    [selectionText],
  )
  const paragraphsText = useMemo(() => {
    if (!cleanSelection) {
      return ""
    }

    return contextSnapshot?.text || cleanSelection
  }, [cleanSelection, contextSnapshot?.text])

  const llmProviders = useMemo(
    () => filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig),
    [providersConfig],
  )
  const executionPlan = useMemo(
    () => buildCustomActionExecutionPlan(customActionRequest, cleanSelection, paragraphsText),
    [cleanSelection, paragraphsText, customActionRequest],
  )
  const {
    isRunning,
    result,
    error,
    resetSessionState,
    thinking,
  } = useCustomActionExecution({
    bodyRef,
    executionContext: executionPlan.executionContext,
    open,
    popoverSessionKey,
    rerunNonce,
  })
  const displayedResult = executionPlan.executionContext ? result : null
  const displayedError = error ?? executionPlan.error
  const displayedIsRunning = executionPlan.executionContext ? isRunning : false
  const displayedThinking = executionPlan.executionContext ? thinking : null

  const handleProviderChange = useCallback((providerId: string) => {
    const updatedCustomActions = selectionToolbarConfig.customActions.map(item =>
      item.id === action.id
        ? { ...item, providerId }
        : item,
    )

    void setConfig({
      selectionToolbar: {
        ...selectionToolbarConfig,
        customActions: updatedCustomActions,
      },
    })
  }, [action.id, selectionToolbarConfig, setConfig])

  const handleRegenerate = useCallback(() => {
    setRerunNonce(prev => prev + 1)
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      captureSelectionSnapshot()
    }
    else {
      clearSelectionSnapshot()
    }

    resetSessionState()
    setOpen(nextOpen)

    if (nextOpen) {
      setIsSelectionToolbarVisible(false)
    }
  }, [captureSelectionSnapshot, clearSelectionSnapshot, resetSessionState, setIsSelectionToolbarVisible])

  if (!activeAction) {
    return null
  }

  return (
    <SelectionPopover.Root open={open} onOpenChange={handleOpenChange}>
      <SelectionToolbarTooltip
        content={activeAction.name}
        render={<SelectionPopover.Trigger aria-label={activeAction.name} />}
      >
        <Icon icon={activeAction.icon} strokeWidth={0.8} className="size-4.5" />
      </SelectionToolbarTooltip>

      <SelectionPopover.Content key={popoverSessionKey} container={shadowWrapper ?? document.body}>
        <SelectionPopover.Header className="border-b">
          <SelectionToolbarTitleContent title={activeAction.name} icon={activeAction.icon} />
          <div className="flex items-center gap-1">
            <SelectionPopover.Pin />
            <SelectionPopover.Close />
          </div>
        </SelectionPopover.Header>

        <SelectionPopover.Body ref={bodyRef}>
          <CustomActionContent
            isRunning={displayedIsRunning}
            outputSchema={activeAction.outputSchema}
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
        />
      </SelectionPopover.Content>
    </SelectionPopover.Root>
  )
}
