import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { LANG_CODE_TO_EN_NAME } from '@read-frog/definitions'
import { IconLoader2, IconVolume } from '@tabler/icons-react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import { isLLMProviderConfig, isTTSProviderConfig } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { featureProviderConfigAtom } from '@/utils/atoms/provider'
import { streamBackgroundText } from '@/utils/content-script/background-stream-client'
import { translateTextForSelection } from '@/utils/host/translate/translate-variants'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { resolveModelId } from '@/utils/providers/model'
import { getProviderOptionsWithOverride } from '@/utils/providers/options'
import {
  isSelectionToolbarVisibleAtom,
  isTranslatePopoverVisibleAtom,
  mouseClickPositionAtom,
  selectionContentAtom,
} from './atom'
import { PopoverWrapper } from './components/popover-wrapper'

export function TranslateButton() {
  // const selectionContent = useAtomValue(selectionContentAtom)
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setIsTranslatePopoverVisible = useSetAtom(isTranslatePopoverVisibleAtom)
  const setMousePosition = useSetAtom(mouseClickPositionAtom)

  const handleClick = async (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left
    const y = rect.top

    setMousePosition({ x, y })
    setIsSelectionToolbarVisible(false)
    setIsTranslatePopoverVisible(true)
  }

  return (
    <button
      type="button"
      className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
      onClick={handleClick}
    >
      <Icon icon="ri:translate" strokeWidth={0.8} className="size-4" />
    </button>
  )
}

export function TranslatePopover() {
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const translateProviderConfig = useAtomValue(featureProviderConfigAtom('selectionToolbar.translate'))
  const languageConfig = useAtomValue(configFieldsAtomMap.language)
  const selectionContent = useAtomValue(selectionContentAtom)
  const [isVisible, setIsVisible] = useAtom(isTranslatePopoverVisibleAtom)

  const handleClose = useCallback(() => {
    setTranslatedText(undefined)
  }, [])

  const handleCopy = useCallback(() => {
    if (translatedText) {
      void navigator.clipboard.writeText(translatedText)
      toast.success('Translation copied to clipboard!')
    }
  }, [translatedText])

  useEffect(() => {
    let cancelTranslation: (() => void) | undefined
    let isCancelled = false

    const translate = async () => {
      const cleanText = selectionContent?.replace(/\u200B/g, '').trim()
      if (!cleanText) {
        return
      }

      setIsTranslating(true)
      cancelTranslation = undefined

      try {
        if (!translateProviderConfig) {
          throw new Error('No provider config when translate text')
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
          const providerOptions = getProviderOptionsWithOverride(modelName ?? '', provider, userProviderOptions)
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
          setTranslatedText(normalized === cleanText ? '' : normalized)
          return
        }

        const backgroundTranslation = await translateTextForSelection(cleanText)
        if (isCancelled) {
          return
        }
        const normalized = backgroundTranslation.trim()
        setTranslatedText(normalized === cleanText ? '' : normalized)
      }
      catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (isCancelled) {
          return
        }

        console.error('Translation error:', error)
        toast.error('Translation failed')
      }
      finally {
        cancelTranslation = undefined
        setIsTranslating(false)
      }
    }

    if (isVisible) {
      void translate()
    }

    return () => {
      isCancelled = true
      cancelTranslation?.()
      cancelTranslation = undefined
    }
  }, [
    isVisible,
    selectionContent,
    languageConfig.targetCode,
    translateProviderConfig,
  ])

  return (
    <PopoverWrapper
      title="Translation"
      icon="ri:translate"
      onClose={handleClose}
      isVisible={isVisible}
      setIsVisible={setIsVisible}
    >
      <div className="p-4 border-b">
        <div className="border-b pb-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectionContent}</p>
        </div>
        <div className="pt-4">
          <p className="text-sm">
            {isTranslating && !translatedText && <Icon icon="svg-spinners:3-dots-bounce" />}
            {translatedText}
            {isTranslating && translatedText && ' ●'}
          </p>
        </div>
      </div>
      <div className="p-4 flex justify-between items-center">
        <div></div>
        <div className="flex items-center gap-2">
          <SpeakOriginalButton />
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
          >
            <Icon
              icon="tabler:copy"
              strokeWidth={1}
              className="size-4 text-zinc-600 dark:text-zinc-400"
            />
          </button>
        </div>
      </div>
    </PopoverWrapper>
  )
}

function SpeakOriginalButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const ttsConfig = useAtomValue(configFieldsAtomMap.tts)
  const ttsProviderConfig = useAtomValue(featureProviderConfigAtom('tts'))
  const { play, isFetching, isPlaying } = useTextToSpeech()

  const handleSpeak = useCallback(async () => {
    if (!selectionContent) {
      toast.error(i18n.t('speak.noTextSelected'))
      return
    }

    if (!ttsProviderConfig || !isTTSProviderConfig(ttsProviderConfig)) {
      toast.error(i18n.t('speak.openaiNotConfigured'))
      return
    }

    void play(selectionContent, ttsConfig, ttsProviderConfig)
  }, [selectionContent, ttsConfig, ttsProviderConfig, play])

  if (!ttsProviderConfig || !isTTSProviderConfig(ttsProviderConfig)) {
    return null
  }

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={isFetching || isPlaying}
      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
      title={isFetching ? 'Fetching audio…' : isPlaying ? 'Playing audio…' : 'Speak original text'}
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
