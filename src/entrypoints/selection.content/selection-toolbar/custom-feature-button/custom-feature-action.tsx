import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useMemo, useRef, useState } from "react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { shadowWrapper } from "../.."
import { SelectionToolbarFooterContent } from "../../components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "../../components/selection-toolbar-title-content"
import { SelectionToolbarTooltip } from "../../components/selection-tooltip"
import { getSelectionParagraphText } from "../../utils"
import {
  isSelectionToolbarVisibleAtom,
  selectionToolbarCustomFeatureRequestAtomFamily,
} from "../atoms"
import { useSelectionPopoverSnapshot } from "../use-selection-popover-snapshot"
import { CustomFeatureContent } from "./custom-feature-content"
import { buildCustomFeatureExecutionPlan, useCustomFeatureExecution } from "./use-custom-feature-execution"

function normalizeSelectedText(value: string | null) {
  return value?.replace(/\u200B/g, "").trim() ?? ""
}

export function SelectionToolbarCustomFeatureAction({ feature }: { feature: SelectionToolbarCustomFeature }) {
  const [open, setOpen] = useState(false)
  const [rerunNonce, setRerunNonce] = useState(0)
  const customFeatureRequest = useAtomValue(selectionToolbarCustomFeatureRequestAtomFamily(feature.id))
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const bodyRef = useRef<HTMLDivElement>(null)
  const {
    selectionContentSnapshot,
    selectionRangeSnapshot,
    popoverSessionKey,
    captureSelectionSnapshot,
    clearSelectionSnapshot,
  } = useSelectionPopoverSnapshot()

  const activeFeature = customFeatureRequest.feature
  const cleanSelection = useMemo(
    () => normalizeSelectedText(selectionContentSnapshot),
    [selectionContentSnapshot],
  )
  const paragraphText = useMemo(() => {
    if (!cleanSelection) {
      return ""
    }

    const paragraphCandidate = selectionRangeSnapshot ? getSelectionParagraphText(selectionRangeSnapshot) : cleanSelection
    return paragraphCandidate || cleanSelection
  }, [cleanSelection, selectionRangeSnapshot])

  const llmProviders = useMemo(
    () => filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig),
    [providersConfig],
  )
  const executionPlan = useMemo(
    () => buildCustomFeatureExecutionPlan(customFeatureRequest, cleanSelection, paragraphText),
    [cleanSelection, customFeatureRequest, paragraphText],
  )
  const {
    isRunning,
    result,
    errorMessage,
    resetSessionState,
    thinking,
  } = useCustomFeatureExecution({
    bodyRef,
    executionContext: executionPlan.executionContext,
    open,
    popoverSessionKey,
    rerunNonce,
  })
  const displayedResult = executionPlan.executionContext ? result : null
  const displayedErrorMessage = errorMessage ?? executionPlan.errorMessage
  const displayedIsRunning = executionPlan.executionContext ? isRunning : false
  const displayedThinking = executionPlan.executionContext ? thinking : null

  const handleProviderChange = useCallback((providerId: string) => {
    const updatedCustomFeatures = selectionToolbarConfig.customFeatures.map(item =>
      item.id === feature.id
        ? { ...item, providerId }
        : item,
    )

    void setConfig({
      selectionToolbar: {
        ...selectionToolbarConfig,
        customFeatures: updatedCustomFeatures,
      },
    })
  }, [feature.id, selectionToolbarConfig, setConfig])

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

  if (!activeFeature) {
    return null
  }

  return (
    <SelectionPopover.Root open={open} onOpenChange={handleOpenChange}>
      <SelectionToolbarTooltip
        content={activeFeature.name}
        render={<SelectionPopover.Trigger aria-label={activeFeature.name} />}
      >
        <Icon icon={activeFeature.icon} strokeWidth={0.8} className="size-4.5" />
      </SelectionToolbarTooltip>

      <SelectionPopover.Content key={popoverSessionKey} container={shadowWrapper ?? document.body}>
        <SelectionPopover.Header className="border-b">
          <SelectionToolbarTitleContent title={activeFeature.name} icon={activeFeature.icon} />
          <div className="flex items-center gap-1">
            <SelectionPopover.Pin />
            <SelectionPopover.Close />
          </div>
        </SelectionPopover.Header>

        <SelectionPopover.Body ref={bodyRef}>
          <CustomFeatureContent
            errorMessage={displayedErrorMessage}
            isRunning={displayedIsRunning}
            outputSchema={activeFeature.outputSchema}
            selectionContent={selectionContentSnapshot}
            value={displayedResult}
            thinking={displayedThinking}
          />
        </SelectionPopover.Body>
        <SelectionToolbarFooterContent
          providers={llmProviders}
          value={customFeatureRequest.providerConfig?.id ?? ""}
          onProviderChange={handleProviderChange}
          onRegenerate={handleRegenerate}
        />
      </SelectionPopover.Content>
    </SelectionPopover.Root>
  )
}
