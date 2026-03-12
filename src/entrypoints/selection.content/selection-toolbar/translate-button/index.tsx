import type { SelectionToolbarTranslateRequestSlice } from "../atom"
import type { LLMProviderConfig, ProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { RiTranslate } from "@remixicon/react"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { isLLMProviderConfig } from "@/types/config/provider"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { getOrFetchArticleData } from "@/utils/host/translate/article-context"
import { translateTextCore } from "@/utils/host/translate/translate-text"
import { getTranslatePromptFromConfig } from "@/utils/prompts/translate"
import { resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { shadowWrapper } from "../.."
import { SelectionToolbarTitleContent } from "../../components/selection-toolbar-title-content"
import {
  isSelectionToolbarVisibleAtom,
  selectionToolbarTranslateRequestAtom,
} from "../atom"
import { useSelectionPopoverSnapshot } from "../use-selection-popover-snapshot"
import { TranslationContent } from "./translation-content"

function normalizeSelectedText(value: string | null) {
  return value?.replace(/\u200B/g, "").trim() ?? ""
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function getProviderConfigOrThrow(translateRequest: SelectionToolbarTranslateRequestSlice): ProviderConfig {
  const providerConfig = translateRequest.providerConfig

  if (!providerConfig) {
    throw new Error("No provider config when translate text")
  }

  return providerConfig
}

async function translateWithLlm({
  cleanText,
  providerConfig,
  translateRequest,
  onChunk,
  registerAbortController,
}: {
  cleanText: string
  providerConfig: LLMProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
  onChunk: (data: string) => void
  registerAbortController: (abortController: AbortController) => void
}) {
  const targetLangName = LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode]
  const {
    id: providerId,
    provider,
    providerOptions: userProviderOptions,
    temperature,
  } = providerConfig
  const modelName = resolveModelId(providerConfig.model)
  const providerOptions = getProviderOptionsWithOverride(modelName ?? "", provider, userProviderOptions)
  const { systemPrompt, prompt } = getTranslatePromptFromConfig(
    { customPromptsConfig: translateRequest.customPromptsConfig },
    targetLangName,
    cleanText,
  )

  const abortController = new AbortController()
  registerAbortController(abortController)

  const translatedText = await streamBackgroundText(
    {
      providerId,
      system: systemPrompt,
      prompt,
      providerOptions,
      temperature,
    },
    {
      signal: abortController.signal,
      onChunk,
    },
  )

  return translatedText
}

async function translateWithStandardProvider({
  cleanText,
  providerConfig,
  translateRequest,
}: {
  cleanText: string
  providerConfig: ProviderConfig
  translateRequest: SelectionToolbarTranslateRequestSlice
}) {
  const articleData = await getOrFetchArticleData(translateRequest.enableAIContentAware)
  const translatedText = await translateTextCore({
    text: cleanText,
    langConfig: translateRequest.language,
    providerConfig,
    enableAIContentAware: translateRequest.enableAIContentAware,
    extraHashTags: ["selectionTranslation"],
    articleContext: articleData ?? undefined,
  })

  return translatedText
}

export function TranslateButton() {
  const [open, setOpen] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const translateRequest = useAtomValue(selectionToolbarTranslateRequestAtom)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const abortControllerRef = useRef<AbortController | null>(null)
  const runIdRef = useRef(0)
  const {
    selectionContentSnapshot,
    popoverSessionKey,
    captureSelectionSnapshot,
    clearSelectionSnapshot,
  } = useSelectionPopoverSnapshot()

  const resetSessionState = useCallback(() => {
    setIsTranslating(false)
    setTranslatedText(undefined)
  }, [])

  const cancelCurrentTranslation = useCallback((runId?: number) => {
    if (runId !== undefined && runIdRef.current !== runId) {
      return
    }

    runIdRef.current += 1
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  const runTranslation = useCallback(async (runId: number) => {
    const cleanText = normalizeSelectedText(selectionContentSnapshot)

    if (cleanText === "") {
      if (runIdRef.current === runId) {
        resetSessionState()
      }
      return
    }

    setIsTranslating(true)
    setTranslatedText(undefined)

    try {
      const providerConfig = getProviderConfigOrThrow(translateRequest)

      let nextTranslatedText = ""
      if (isLLMProviderConfig(providerConfig)) {
        nextTranslatedText = await translateWithLlm({
          cleanText,
          providerConfig,
          translateRequest,
          onChunk: (data) => {
            if (runIdRef.current === runId) {
              setTranslatedText(data)
            }
          },
          registerAbortController: (abortController) => {
            abortControllerRef.current = abortController
          },
        })
      }
      else {
        nextTranslatedText = await translateWithStandardProvider({
          cleanText,
          providerConfig,
          translateRequest,
        })
      }

      if (runIdRef.current === runId) {
        setTranslatedText(nextTranslatedText)
      }
    }
    catch (error) {
      if (!isAbortError(error) && runIdRef.current === runId) {
        console.error("Translation error:", error)
        toast.error(i18n.t("translationHub.translationFailed"), {
          description: error instanceof Error ? error.message : String(error),
        })
      }
    }
    finally {
      if (runIdRef.current === runId) {
        abortControllerRef.current = null
        setIsTranslating(false)
      }
    }
  }, [resetSessionState, selectionContentSnapshot, translateRequest])

  const startTranslation = useEffectEvent((runId: number) => {
    void runTranslation(runId)
  })

  useEffect(() => {
    if (!open) {
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    startTranslation(runId)

    return () => {
      cancelCurrentTranslation(runId)
    }
  }, [cancelCurrentTranslation, open, popoverSessionKey, selectionContentSnapshot, translateRequest])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    cancelCurrentTranslation()
    resetSessionState()

    if (nextOpen) {
      captureSelectionSnapshot()
    }
    else {
      clearSelectionSnapshot()
    }

    setOpen(nextOpen)

    if (nextOpen) {
      setIsSelectionToolbarVisible(false)
    }
  }, [cancelCurrentTranslation, captureSelectionSnapshot, clearSelectionSnapshot, resetSessionState, setIsSelectionToolbarVisible])

  return (
    <SelectionPopover.Root open={open} onOpenChange={handleOpenChange}>
      <SelectionPopover.Trigger title="Translation">
        <RiTranslate className="size-4.5" />
      </SelectionPopover.Trigger>

      <SelectionPopover.Content key={popoverSessionKey} container={shadowWrapper ?? document.body}>
        <SelectionPopover.Header className="border-b">
          <SelectionToolbarTitleContent
            title="Translation"
            icon="ri:translate"
          />
          <div className="flex items-center gap-1">
            <SelectionPopover.Pin />
            <SelectionPopover.Close />
          </div>
        </SelectionPopover.Header>

        <SelectionPopover.Body>
          <TranslationContent
            selectionContent={selectionContentSnapshot}
            translatedText={translatedText}
            isTranslating={isTranslating}
          />
        </SelectionPopover.Body>
      </SelectionPopover.Content>
    </SelectionPopover.Root>
  )
}
