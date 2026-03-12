import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { streamBackgroundStructuredObject } from "@/utils/content-script/background-stream-client"
import { resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { shadowWrapper } from ".."
import { SelectionToolbarFooterContent } from "../components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "../components/selection-toolbar-title-content"
import { getSelectionParagraphText } from "../utils"
import {
  isSelectionToolbarVisibleAtom,
  selectionToolbarCustomFeatureRequestAtomFamily,
} from "./atom"
import { buildSelectionToolbarCustomFeatureSystemPrompt, replaceSelectionToolbarCustomFeaturePromptTokens } from "./custom-feature-prompt"
import { StructuredObjectRenderer } from "./structured-object-renderer"
import { useSelectionPopoverSnapshot } from "./use-selection-popover-snapshot"

function normalizeSelectedText(value: string | null) {
  return value?.replace(/\u200B/g, "").trim() ?? ""
}

function getCustomFeatureErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Custom feature request failed"
}

function scrollSelectionPopoverBodyToBottom(ref: React.RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  })
}

function SelectionToolbarCustomFeatureAction({ feature }: { feature: SelectionToolbarCustomFeature }) {
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

  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resetSessionState = useCallback(() => {
    setIsRunning(false)
    setResult(null)
    setErrorMessage(null)
  }, [])

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

  useEffect(() => {
    if (!open) {
      return
    }

    let isCancelled = false
    const abortController = new AbortController()

    const run = async () => {
      const setRequestError = (message: string) => {
        if (isCancelled) {
          return
        }

        setIsRunning(false)
        setResult(null)
        setErrorMessage(message)
      }

      if (!cleanSelection) {
        setRequestError("No selected text available")
        return
      }

      const currentFeature = customFeatureRequest.feature

      if (!currentFeature) {
        setRequestError("Selected feature is unavailable")
        return
      }

      const providerConfig = customFeatureRequest.providerConfig
      if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
        setRequestError("Selected provider is unavailable for this feature")
        return
      }

      if (!providerConfig.enabled) {
        setRequestError("Selected provider is disabled")
        return
      }

      const targetLang = LANG_CODE_TO_EN_NAME[customFeatureRequest.language.targetCode]
      const pageTitle = document.title

      const promptTokens = {
        selection: cleanSelection,
        context: paragraphText,
        targetLang,
        title: pageTitle,
      }
      const systemPrompt = buildSelectionToolbarCustomFeatureSystemPrompt(
        currentFeature.systemPrompt,
        promptTokens,
        currentFeature.outputSchema,
      )
      const prompt = replaceSelectionToolbarCustomFeaturePromptTokens(currentFeature.prompt, promptTokens)
      const modelName = resolveModelId(providerConfig.model) ?? ""
      const providerOptions = getProviderOptionsWithOverride(
        modelName,
        providerConfig.provider,
        providerConfig.providerOptions,
      )

      setIsRunning(true)
      setResult(null)
      setErrorMessage(null)

      try {
        const finalResult = await streamBackgroundStructuredObject(
          {
            providerId: providerConfig.id,
            system: systemPrompt,
            prompt,
            outputSchema: currentFeature.outputSchema.map(({ name, type }) => ({ name, type })),
            providerOptions,
            temperature: providerConfig.temperature,
          },
          {
            signal: abortController.signal,
            onChunk: (partial) => {
              if (isCancelled) {
                return
              }

              setResult(prev => ({ ...(prev ?? {}), ...partial }))
              scrollSelectionPopoverBodyToBottom(bodyRef)
            },
          },
        )

        if (isCancelled) {
          return
        }

        setResult(finalResult)
      }
      catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        if (isCancelled) {
          return
        }

        setErrorMessage(getCustomFeatureErrorMessage(error))
      }
      finally {
        if (!isCancelled) {
          setIsRunning(false)
        }
      }
    }

    void run()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [
    cleanSelection,
    customFeatureRequest,
    open,
    paragraphText,
    popoverSessionKey,
    rerunNonce,
  ])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      captureSelectionSnapshot()
      resetSessionState()
    }
    else {
      clearSelectionSnapshot()
      resetSessionState()
    }

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
      <SelectionPopover.Trigger title={activeFeature.name}>
        <Icon icon={activeFeature.icon} strokeWidth={0.8} className="size-4.5" />
      </SelectionPopover.Trigger>

      <SelectionPopover.Content key={popoverSessionKey} container={shadowWrapper ?? document.body}>
        <SelectionPopover.Header className="border-b">
          <SelectionToolbarTitleContent title={activeFeature.name} icon={activeFeature.icon} />
          <div className="flex items-center gap-1">
            <SelectionPopover.Pin />
            <SelectionPopover.Close />
          </div>
        </SelectionPopover.Header>

        <SelectionPopover.Body ref={bodyRef}>
          <div className="p-4 space-y-4">
            <div className="border-b pb-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">Selection</p>
              <p className="text-sm whitespace-pre-wrap wrap-break-words text-zinc-700 dark:text-zinc-300">{selectionContentSnapshot || "—"}</p>
            </div>

            <StructuredObjectRenderer
              outputSchema={activeFeature.outputSchema}
              value={result}
              isStreaming={isRunning}
            />

            {isRunning && (
              <p className="text-xs text-zinc-500 dark:text-zinc-500">Streaming structured output…</p>
            )}

            {errorMessage && (
              <div className="space-y-2">
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {errorMessage}
                </div>
              </div>
            )}
          </div>
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

export function SelectionToolbarCustomFeatureButtons() {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const customFeatures = selectionToolbarConfig.customFeatures?.filter(feature => feature.enabled !== false) ?? []

  return customFeatures.map(feature => (
    <SelectionToolbarCustomFeatureAction key={feature.id} feature={feature} />
  ))
}
