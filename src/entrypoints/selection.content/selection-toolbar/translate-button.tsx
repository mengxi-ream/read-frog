import { i18n } from "#imports"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { RiTranslate } from "@remixicon/react"
import { IconChevronDown, IconChevronUp, IconCopy, IconLoader2, IconVolume } from "@tabler/icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import { Activity, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { Separator } from "@/components/ui/base-ui/separator"
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
          <TranslationContent
            selectionContent={selectionContent}
            translatedText={translatedText}
            isTranslating={isTranslating}
            onCopy={handleCopy}
          />
        </SelectionPopover.Body>
      </SelectionPopover.Content>
    </SelectionPopover.Root>
  )
}

interface TranslationContentProps {
  selectionContent: string | null | undefined
  translatedText: string | undefined
  isTranslating: boolean
  onCopy: () => void
}

function TranslationContent({ selectionContent, translatedText, isTranslating, onCopy }: TranslationContentProps) {
  const [actionsExpanded, setActionsExpanded] = useState(false)

  return (
    <div className="p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectionContent}</p>
          <Button
            variant="ghost-secondary"
            size="icon-sm"
            onClick={() => setActionsExpanded(prev => !prev)}
          >
            <Activity mode={actionsExpanded ? "visible" : "hidden"}>
              <IconChevronUp />
            </Activity>
            <Activity mode={actionsExpanded ? "hidden" : "visible"}>
              <IconChevronDown />
            </Activity>
          </Button>
        </div>
        <Activity mode={actionsExpanded ? "visible" : "hidden"}>
          <div className="flex items-center gap-1 mt-1">
            <Button
              variant="ghost-secondary"
              size="icon-sm"
              onClick={onCopy}
            >
              <IconCopy />
            </Button>
            <SpeakOriginalButton />
          </div>
        </Activity>
      </div>
      <Separator className="h-[0.5px] my-2" />
      <div>
        <p className="text-sm">
          {isTranslating && !translatedText && <IconLoader2 className="inline size-4 animate-spin" strokeWidth={1.6} />}
          {translatedText}
          {isTranslating && translatedText && " ●"}
        </p>
      </div>
    </div>
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
    <Button
      variant="ghost-secondary"
      size="icon-sm"
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
    </Button>
  )
}
