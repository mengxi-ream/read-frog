import { i18n } from "#imports"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { RiTranslate } from "@remixicon/react"
import { IconCopy, IconLoader2, IconVolume } from "@tabler/icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { featureProviderConfigAtom } from "@/utils/atoms/provider"
import { streamBackgroundText } from "@/utils/content-script/background-stream-client"
import { translateTextForSelection } from "@/utils/host/translate/translate-variants"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { resolveModelId } from "@/utils/providers/model"
import { getProviderOptionsWithOverride } from "@/utils/providers/options"
import { shadowWrapper } from ".."
import { isSelectionToolbarVisibleAtom, selectionContentAtom } from "./atom"
import { SelectionToolbarTitleContent } from "./selection-toolbar-title-content"

export function TranslateButton() {
  const [open, setOpen] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const translateProviderConfig = useAtomValue(featureProviderConfigAtom("selectionToolbar.translate"))
  const languageConfig = useAtomValue(configFieldsAtomMap.language)
  const selectionContent = useAtomValue(selectionContentAtom)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)

  const handleCopy = useCallback(() => {
    if (translatedText) {
      void navigator.clipboard.writeText(translatedText)
      toast.success("Translation copied to clipboard!")
    }
  }, [translatedText])

  useEffect(() => {
    let cancelTranslation: (() => void) | undefined
    let isCancelled = false

    const translate = async () => {
      const cleanText = selectionContent?.replace(/\u200B/g, "").trim()
      if (!cleanText) {
        return
      }

      setIsTranslating(true)
      cancelTranslation = undefined

      try {
        if (!translateProviderConfig) {
          throw new Error("No provider config when translate text")
        }

        if (isLLMProviderConfig(translateProviderConfig)) {
          const targetLangName = LANG_CODE_TO_EN_NAME[languageConfig.targetCode]
          const {
            id: providerId,
            provider,
            providerOptions: userProviderOptions,
            temperature,
          } = translateProviderConfig
          const modelName = resolveModelId(translateProviderConfig.model)
          const providerOptions = getProviderOptionsWithOverride(modelName ?? "", provider, userProviderOptions)
          const { systemPrompt, prompt } = await getTranslatePrompt(targetLangName, cleanText)

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

        const backgroundTranslation = await translateTextForSelection(cleanText)
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
    languageConfig.targetCode,
    open,
    selectionContent,
    translateProviderConfig,
  ])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)

    if (nextOpen) {
      setIsSelectionToolbarVisible(false)
      return
    }

    setTranslatedText(undefined)
  }, [setIsSelectionToolbarVisible])

  return (
    <SelectionPopover.Root open={open} onOpenChange={handleOpenChange}>
      <SelectionPopover.Trigger title="Translation">
        <RiTranslate className="size-4.5" />
      </SelectionPopover.Trigger>

      <SelectionPopover.Content container={shadowWrapper ?? document.body}>
        <SelectionPopover.Header className="border-b">
          <SelectionToolbarTitleContent
            title="Translation"
            icon={<RiTranslate className="size-4.5 text-zinc-600 dark:text-zinc-400" />}
          />
          <SelectionPopover.Close />
        </SelectionPopover.Header>

        <SelectionPopover.Body>
          <div className="p-4 border-b">
            <div className="border-b pb-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectionContent}</p>
            </div>
            <div className="pt-4">
              <p className="text-sm">
                {isTranslating && !translatedText && <IconLoader2 className="inline size-4 animate-spin" strokeWidth={1.6} />}
                {translatedText}
                {isTranslating && translatedText && " ●"}
              </p>
            </div>
          </div>
        </SelectionPopover.Body>

        <SelectionPopover.Footer className="justify-between">
          <div></div>
          <div className="flex items-center gap-2">
            <SpeakOriginalButton />
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
            >
              <IconCopy strokeWidth={1.6} className="size-4 text-zinc-600 dark:text-zinc-400" />
            </button>
          </div>
        </SelectionPopover.Footer>
      </SelectionPopover.Content>
    </SelectionPopover.Root>
  )
}

function SpeakOriginalButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const { play, isFetching, isPlaying } = useTextToSpeech()

  const handleSpeak = useCallback(async () => {
    if (!selectionContent) {
      toast.error(i18n.t("speak.noTextSelected"))
      return
    }

    void play(selectionContent, ttsConfig)
  }, [selectionContent, ttsConfig, play])

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={isFetching || isPlaying}
      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      title={isFetching ? "Fetching audio…" : isPlaying ? "Playing audio…" : "Speak original text"}
    >
      {isFetching || isPlaying
        ? (
            <IconLoader2
              className="size-4 text-zinc-600 dark:text-zinc-400 animate-spin"
              strokeWidth={1.6}
            />
          )
        : (
            <IconVolume className="size-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
          )}
    </button>
  )
}
