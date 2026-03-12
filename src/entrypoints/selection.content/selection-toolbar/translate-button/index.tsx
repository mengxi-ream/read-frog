import { i18n } from "#imports"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { RiTranslate } from "@remixicon/react"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useState } from "react"
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

export function TranslateButton() {
  const [open, setOpen] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const translateRequest = useAtomValue(selectionToolbarTranslateRequestAtom)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
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

  useEffect(() => {
    let cancelTranslation: (() => void) | undefined
    let isCancelled = false

    const translate = async () => {
      const cleanText = normalizeSelectedText(selectionContentSnapshot)
      if (!cleanText) {
        return
      }

      setIsTranslating(true)
      cancelTranslation = undefined

      try {
        const articleData = await getOrFetchArticleData(translateRequest.enableAIContentAware)
        const translateProviderConfig = translateRequest.providerConfig

        if (!translateProviderConfig) {
          throw new Error("No provider config when translate text")
        }

        if (isLLMProviderConfig(translateProviderConfig)) {
          const targetLangName = LANG_CODE_TO_EN_NAME[translateRequest.language.targetCode]
          const {
            id: providerId,
            provider,
            providerOptions: userProviderOptions,
            temperature,
          } = translateProviderConfig
          const modelName = resolveModelId(translateProviderConfig.model)
          const providerOptions = getProviderOptionsWithOverride(modelName ?? "", provider, userProviderOptions)
          const { systemPrompt, prompt } = getTranslatePromptFromConfig(
            { customPromptsConfig: translateRequest.customPromptsConfig },
            targetLangName,
            cleanText,
          )

          const abortController = new AbortController()
          cancelTranslation = () => abortController.abort()

          const latestText = await streamBackgroundText(
            {
              providerId,
              system: systemPrompt,
              prompt,
              providerOptions,
              temperature,
            },
            {
              signal: abortController.signal,
              onChunk: (data) => {
                if (!isCancelled) {
                  setTranslatedText(data)
                }
              },
            },
          )

          if (isCancelled) {
            return
          }

          const normalized = latestText.trim()
          setTranslatedText(normalized === cleanText ? "" : normalized)
          return
        }

        const backgroundTranslation = await translateTextCore({
          text: cleanText,
          langConfig: translateRequest.language,
          providerConfig: translateProviderConfig,
          enableAIContentAware: translateRequest.enableAIContentAware,
          extraHashTags: ["selectionTranslation"],
          articleContext: articleData ?? undefined,
        })
        if (isCancelled) {
          return
        }

        const normalized = backgroundTranslation.trim()
        setTranslatedText(normalized === cleanText ? "" : normalized)
      }
      catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        if (isCancelled) {
          return
        }

        console.error("Translation error:", error)
        toast.error(i18n.t("translationHub.translationFailed"), {
          description: error instanceof Error ? error.message : String(error),
        })
      }
      finally {
        cancelTranslation = undefined
        setIsTranslating(false)
      }
    }

    if (open) {
      void translate()
    }

    return () => {
      isCancelled = true
      cancelTranslation?.()
      cancelTranslation = undefined
    }
  }, [
    open,
    popoverSessionKey,
    selectionContentSnapshot,
    translateRequest,
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
