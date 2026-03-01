import type { PopoverWrapperRef } from "./components/popover-wrapper"
import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { streamBackgroundStructuredObject } from "@/utils/content-script/background-stream-client"
import { resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { getSelectionParagraphText } from "../utils"
import {
  activeCustomFeatureIdAtom,
  isCustomFeaturePopoverVisibleAtom,
  isSelectionToolbarVisibleAtom,
  mouseClickPositionAtom,
  selectionContentAtom,
  selectionRangeAtom,
} from "./atom"
import { PopoverWrapper } from "./components/popover-wrapper"
import { replaceSelectionToolbarCustomFeaturePromptTokens } from "./custom-feature-prompt"
import { StructuredObjectRenderer } from "./structured-object-renderer"

function normalizeSelectedText(value: string | null) {
  return value?.replace(/\u200B/g, "").trim() ?? ""
}

function getCustomFeatureErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Custom feature request failed"
}

function SelectionToolbarCustomFeatureButton({ feature }: { feature: SelectionToolbarCustomFeature }) {
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setIsCustomFeaturePopoverVisible = useSetAtom(isCustomFeaturePopoverVisibleAtom)
  const setMousePosition = useSetAtom(mouseClickPositionAtom)
  const setActiveCustomFeatureId = useSetAtom(activeCustomFeatureIdAtom)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setMousePosition({ x: rect.left, y: rect.top })
    setActiveCustomFeatureId(feature.id)
    setIsSelectionToolbarVisible(false)
    setIsCustomFeaturePopoverVisible(true)
  }

  return (
    <button
      type="button"
      className="size-6 shrink-0 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
      onClick={handleClick}
      title={feature.name}
    >
      <Icon icon={feature.icon} strokeWidth={0.8} className="size-4" />
    </button>
  )
}

export function SelectionToolbarCustomFeatureButtons() {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const customFeatures = selectionToolbarConfig.customFeatures?.filter(feature => feature.enabled !== false) ?? []

  return customFeatures.map(feature => (
    <SelectionToolbarCustomFeatureButton key={feature.id} feature={feature} />
  ))
}

export function SelectionToolbarCustomFeaturePopover() {
  const [isVisible, setIsVisible] = useAtom(isCustomFeaturePopoverVisibleAtom)
  const [activeCustomFeatureId, setActiveCustomFeatureId] = useAtom(activeCustomFeatureIdAtom)
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const languageConfig = useAtomValue(configFieldsAtomMap.language)
  const selectionContent = useAtomValue(selectionContentAtom)
  const selectionRange = useAtomValue(selectionRangeAtom)
  const popoverRef = useRef<PopoverWrapperRef>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const activeFeature = useMemo(
    () => selectionToolbarConfig.customFeatures?.find(feature => feature.enabled !== false && feature.id === activeCustomFeatureId) ?? null,
    [selectionToolbarConfig.customFeatures, activeCustomFeatureId],
  )
  const cleanSelection = useMemo(
    () => normalizeSelectedText(selectionContent),
    [selectionContent],
  )
  const paragraphText = useMemo(() => {
    if (!cleanSelection) {
      return ""
    }

    const paragraphCandidate = selectionRange ? getSelectionParagraphText(selectionRange) : cleanSelection
    return paragraphCandidate || cleanSelection
  }, [cleanSelection, selectionRange])

  const handleClose = useCallback(() => {
    setActiveCustomFeatureId(null)
    setIsRunning(false)
    setResult(null)
    setErrorMessage(null)
  }, [setActiveCustomFeatureId])

  useEffect(() => {
    if (!isVisible || !activeFeature) {
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

      const providerConfig = providersConfig.find(provider => provider.id === activeFeature.providerId)
      if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
        setRequestError("Selected provider is unavailable for this feature")
        return
      }

      if (!providerConfig.enabled) {
        setRequestError("Selected provider is disabled")
        return
      }

      const targetLang = LANG_CODE_TO_EN_NAME[languageConfig.targetCode]
      const pageTitle = document.title

      const promptTokens = {
        selection: cleanSelection,
        context: paragraphText,
        targetLang,
        title: pageTitle,
      }
      const systemPrompt = replaceSelectionToolbarCustomFeaturePromptTokens(activeFeature.systemPrompt, promptTokens)
      const prompt = replaceSelectionToolbarCustomFeaturePromptTokens(activeFeature.prompt, promptTokens)
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
            outputSchema: activeFeature.outputSchema.map(({ name, type }) => ({ name, type })),
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
              popoverRef.current?.scrollToBottom()
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
  }, [activeFeature, cleanSelection, isVisible, languageConfig.targetCode, paragraphText, providersConfig])

  return (
    <PopoverWrapper
      ref={popoverRef}
      title={activeFeature?.name ?? "Custom AI Feature"}
      icon={activeFeature?.icon ?? "tabler:sparkles"}
      isVisible={isVisible}
      setIsVisible={setIsVisible}
      onClose={handleClose}
    >
      <div className="p-4 space-y-4">
        <div className="border-b pb-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">Selection</p>
          <p className="text-sm whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-300">{selectionContent || "—"}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-3 mb-2">Paragraph</p>
          <p className="text-sm whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-300">{paragraphText || "—"}</p>
        </div>

        {activeFeature && (
          <StructuredObjectRenderer
            outputSchema={activeFeature.outputSchema}
            value={result}
            isStreaming={isRunning}
          />
        )}

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
    </PopoverWrapper>
  )
}
