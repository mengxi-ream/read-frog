import { browser, i18n, useCallback, useMemo, useRef, useState } from "#imports"
import { IconAlertTriangle, IconZoomScan } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue, useSetAtom } from "jotai"
import { Activity } from "react"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Alert, AlertDescription } from "@/components/ui/base-ui/alert"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { detectedCodeAtom } from "@/utils/atoms/detected-code"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { getFinalSourceCode } from "@/utils/config/languages"
import { buildFeatureProviderPatch } from "@/utils/constants/feature-providers"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { getWordExplainPrompt } from "@/utils/prompts/word-explain"
import { resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { shadowWrapper } from ".."
import { SelectionSourceContent } from "../components/selection-source-content"
import { SelectionToolbarFooterContent } from "../components/selection-toolbar-footer-content"
import { SelectionToolbarTitleContent } from "../components/selection-toolbar-title-content"
import { SelectionToolbarTooltip } from "../components/selection-tooltip"
import {
  isSelectionToolbarVisibleAtom,
  selectionToolbarVocabularyInsightRequestAtom,
} from "./atoms"
import { useSelectionPopoverSnapshot } from "./use-selection-popover-snapshot"

function scrollSelectionPopoverBodyToBottom(ref: React.RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  })
}

interface AiButtonQueryMeta {
  bodyRef: React.RefObject<HTMLDivElement | null>
  setAiResponse: React.Dispatch<React.SetStateAction<string>>
}

function isAiButtonQueryMeta(meta: unknown): meta is AiButtonQueryMeta {
  if (!meta || typeof meta !== "object") {
    return false
  }

  const candidate = meta as Partial<AiButtonQueryMeta>
  return typeof candidate.setAiResponse === "function"
    && typeof candidate.bodyRef === "object"
    && candidate.bodyRef !== null
    && "current" in candidate.bodyRef
}

export function AiButton() {
  const [open, setOpen] = useState(false)
  const [rerunNonce, setRerunNonce] = useState(0)
  const detectedCode = useAtomValue(detectedCodeAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const vocabularyInsightRequest = useAtomValue(selectionToolbarVocabularyInsightRequestAtom)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [aiResponse, setAiResponse] = useState("")
  const {
    contextSnapshot,
    popoverSessionKey,
    selectionSnapshot,
    captureSelectionSnapshot,
    clearSelectionSnapshot,
  } = useSelectionPopoverSnapshot()

  const resetSessionState = useCallback(() => {
    setAiResponse("")
  }, [])
  const selectionText = selectionSnapshot?.text ?? null
  const paragraphsText = contextSnapshot?.text ?? selectionText
  const titleText = document.title || null

  const highlightData = useMemo(() => {
    if (!selectionSnapshot || !open) {
      return null
    }

    const data = {
      selection: selectionSnapshot.text,
      context: contextSnapshot?.text || selectionSnapshot.text,
    }
    logger.info("highlightData.context", "\n", data.context)
    return data
  }, [contextSnapshot?.text, open, selectionSnapshot])
  const llmProviders = useMemo(
    () => filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig),
    [providersConfig],
  )
  const triggerLabel = i18n.t("action.vocabularyInsight")

  const {
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "analyzeSelection",
      popoverSessionKey,
      rerunNonce,
      highlightData,
      vocabularyInsightRequest,
      detectedCode,
    ],
    meta: {
      bodyRef,
      setAiResponse,
    } satisfies AiButtonQueryMeta,
    queryFn: async ({ signal, meta }) => {
      if (!isAiButtonQueryMeta(meta)) {
        throw new Error("Missing vocabulary insight query metadata")
      }

      if (!highlightData) {
        throw new Error("No provider config for vocabulary insight or no selection")
      }
      const vocabularyInsightProviderConfig = vocabularyInsightRequest.providerConfig

      if (!vocabularyInsightProviderConfig || !isLLMProviderConfig(vocabularyInsightProviderConfig)) {
        throw new Error("Vocabulary insight requires an LLM provider")
      }

      meta.setAiResponse("")

      try {
        if (signal?.aborted) {
          return false
        }

        const actualSourceCode = getFinalSourceCode(vocabularyInsightRequest.language.sourceCode, detectedCode)
        const systemPrompt = getWordExplainPrompt(
          actualSourceCode,
          vocabularyInsightRequest.language.targetCode,
          vocabularyInsightRequest.language.level,
        )
        const userMessage
          = `query: ${highlightData.selection}\n`
            + `context: ${highlightData.context}`

        const modelName = resolveModelId(vocabularyInsightProviderConfig.model) ?? ""
        const providerOptions = getProviderOptionsWithOverride(
          modelName,
          vocabularyInsightProviderConfig.provider,
          vocabularyInsightProviderConfig.providerOptions,
        )

        const finalResponse = await streamBackgroundText(
          {
            providerId: vocabularyInsightProviderConfig.id,
            temperature: 0.2,
            providerOptions,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userMessage,
              },
            ],
          },
          {
            signal,
            onChunk: (data) => {
              meta.setAiResponse(data.output)
              scrollSelectionPopoverBodyToBottom(meta.bodyRef)
            },
          },
        )

        logger.log("aiResponse", "\n", finalResponse.output)
        return true
      }
      catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return false
        }
        throw error
      }
    },
    enabled: !!highlightData,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })

  const handleProviderChange = useCallback((providerId: string) => {
    void setConfig(buildFeatureProviderPatch({ "selectionToolbar.vocabularyInsight": providerId }))
  }, [setConfig])

  const handleRegenerate = useCallback(() => {
    setRerunNonce(prev => prev + 1)
  }, [])

  const handleOpenDictionarySetup = useCallback(() => {
    const url = browser.runtime.getURL("/options.html#/custom-actions?addAction=dictionary")
    void sendMessage("openPage", { url, active: true })
  }, [])

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

  return (
    <SelectionPopover.Root open={open} onOpenChange={handleOpenChange}>
      <SelectionToolbarTooltip
        content={triggerLabel}
        render={<SelectionPopover.Trigger aria-label={triggerLabel} />}
      >
        <IconZoomScan className="size-4.5" />
      </SelectionToolbarTooltip>

      <SelectionPopover.Content key={popoverSessionKey} container={shadowWrapper ?? document.body}>
        <SelectionPopover.Header className="border-b">
          <SelectionToolbarTitleContent
            title="Vocabulary Insight"
            icon="tabler:sparkles"
          />
          <div className="flex items-center gap-1">
            <SelectionPopover.Pin />
            <SelectionPopover.Close />
          </div>
        </SelectionPopover.Header>

        <SelectionPopover.Body ref={bodyRef}>
          <div className="p-4 pt-0">
            <Alert className="mb-3 mt-4 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
              <IconAlertTriangle className="size-4" />
              <AlertDescription>
                {i18n.t("action.vocabularyInsightDeprecation")}
                {" "}
                <button type="button" className="cursor-pointer underline underline-offset-2 font-medium" onClick={handleOpenDictionarySetup}>
                  {i18n.t("action.vocabularyInsightDeprecationLink")}
                </button>
              </AlertDescription>
            </Alert>
            <div className="border-b pb-4 sticky pt-4 top-0 bg-white dark:bg-zinc-800 z-10">
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">Selected text:</p>
              <SelectionSourceContent text={selectionSnapshot?.text} separatorClassName="mb-4" />
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">Context:</p>
              <div className="text-sm whitespace-pre-wrap wrap-break-words text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 p-3 rounded leading-relaxed">
                {highlightData?.context ?? ""}
              </div>
            </div>
            <div className="pt-4">
              <Activity mode={isLoading && !aiResponse ? "visible" : "hidden"}>
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center space-x-3 text-slate-500">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                    <span className="text-sm font-medium">词汇解析中...</span>
                  </div>
                </div>
              </Activity>

              <Activity mode={error ? "visible" : "hidden"}>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">!</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">分析失败</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error?.message}</p>
                    </div>
                  </div>
                </div>
              </Activity>

              <Activity mode={aiResponse ? "visible" : "hidden"}>
                <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <MarkdownRenderer content={aiResponse} />
                </div>
              </Activity>
            </div>
          </div>
        </SelectionPopover.Body>
        <SelectionToolbarFooterContent
          paragraphsText={paragraphsText}
          providers={llmProviders}
          titleText={titleText}
          value={vocabularyInsightRequest.providerConfig?.id ?? ""}
          onProviderChange={handleProviderChange}
          onRegenerate={handleRegenerate}
        />
      </SelectionPopover.Content>
    </SelectionPopover.Root>
  )
}
