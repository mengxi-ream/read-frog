import type { TextUIPart } from 'ai'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME } from '@read-frog/definitions'
import { IconLoader2, IconVolume } from '@tabler/icons-react'
import { readUIMessageStream, streamText } from 'ai'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import {
  isLLMTranslateProviderConfig,
  isNonAPIProvider,
  isPureAPIProvider,
} from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { translateProviderConfigAtom, ttsProviderConfigAtom } from '@/utils/atoms/provider'
import { getLocalConfig } from '@/utils/config/storage'
import { getProviderOptions } from '@/utils/constants/model'
import { getIsFirefoxExtensionEnv } from '@/utils/firefox/firefox-compat'
import { createPortStreamPromise } from '@/utils/firefox/firefox-streaming'
import { deeplxTranslate, googleTranslate, microsoftTranslate } from '@/utils/host/translate/api'
import { translateText } from '@/utils/host/translate/translate-text'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModelById } from '@/utils/providers/model'
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
  const translateProviderConfig = useAtomValue(translateProviderConfigAtom)
  const languageConfig = useAtomValue(configFieldsAtomMap.language)
  const selectionContent = useAtomValue(selectionContentAtom)
  const [isVisible, setIsVisible] = useAtom(isTranslatePopoverVisibleAtom)
  const isFirefoxExtensionEnv = useMemo(() => getIsFirefoxExtensionEnv(), [])

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

      const config = await getLocalConfig()
      if (!config) {
        throw new Error('No global config when translate text')
      }

      if (!translateProviderConfig) {
        throw new Error(
          `No provider config for ${config.translate.providerId} when translate text`,
        )
      }

      const { provider } = translateProviderConfig

      setIsTranslating(true)
      cancelTranslation = undefined

      try {
        if (isFirefoxExtensionEnv && isLLMTranslateProviderConfig(translateProviderConfig)) {
          const targetLangName = LANG_CODE_TO_EN_NAME[languageConfig.targetCode]
          const {
            id: providerId,
            models: { translate },
          } = translateProviderConfig
          const translateModel = translate.isCustomModel ? translate.customModel : translate.model
          const providerOptions = getProviderOptions(translateModel ?? '')
          const prompt = await getTranslatePrompt(targetLangName, cleanText)

          const abortController = new AbortController()
          cancelTranslation = () => abortController.abort()

          const latestText = await createPortStreamPromise<string>(
            'translate-text-stream',
            {
              providerId,
              prompt,
              providerOptions,
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

        if (isFirefoxExtensionEnv) {
          const backgroundTranslation = await translateText(cleanText)
          if (isCancelled) {
            return
          }
          const normalized = backgroundTranslation.trim()
          setTranslatedText(normalized === cleanText ? '' : normalized)
          return
        }

        let translatedText = ''

        if (isNonAPIProvider(provider)) {
          const sourceLang
            = languageConfig.sourceCode === 'auto'
              ? 'auto'
              : ISO6393_TO_6391[languageConfig.sourceCode] ?? 'auto'
          const targetLang = ISO6393_TO_6391[languageConfig.targetCode]
          if (!targetLang) {
            throw new Error(`Invalid target language code: ${languageConfig.targetCode}`)
          }

          if (provider === 'google') {
            translatedText = await googleTranslate(cleanText, sourceLang, targetLang)
          }
          else if (provider === 'microsoft') {
            translatedText = await microsoftTranslate(cleanText, sourceLang, targetLang)
          }
        }
        else if (isPureAPIProvider(provider)) {
          const sourceLang
            = languageConfig.sourceCode === 'auto'
              ? 'auto'
              : ISO6393_TO_6391[languageConfig.sourceCode] ?? 'auto'
          const targetLang = ISO6393_TO_6391[languageConfig.targetCode]
          if (!targetLang) {
            throw new Error(`Invalid target language code: ${languageConfig.targetCode}`)
          }

          if (provider === 'deeplx') {
            translatedText = await deeplxTranslate(
              cleanText,
              sourceLang,
              targetLang,
              translateProviderConfig,
              { forceBackgroundFetch: true },
            )
          }
        }
        else if (isLLMTranslateProviderConfig(translateProviderConfig)) {
          const targetLangName = LANG_CODE_TO_EN_NAME[languageConfig.targetCode]
          const {
            id: providerId,
            models: { translate },
          } = translateProviderConfig
          const translateModel = translate.isCustomModel ? translate.customModel : translate.model
          const model = await getTranslateModelById(providerId)

          const providerOptions = getProviderOptions(translateModel ?? '')
          const { systemPrompt, prompt } = await getTranslatePrompt(targetLangName, cleanText)

          const result = streamText({
            model,
            system: systemPrompt,
            prompt,
            providerOptions,
          })

          const abortController = new AbortController()
          cancelTranslation = () => {
            abortController.abort()
          }

          for await (const uiMessage of readUIMessageStream({
            stream: result.toUIMessageStream(),
          })) {
            if (isCancelled || abortController.signal.aborted) {
              return
            }
            const lastPart = uiMessage.parts[uiMessage.parts.length - 1] as TextUIPart
            setTranslatedText(lastPart.text)
          }

          cancelTranslation = undefined
        }
        else {
          throw new Error(`Unknown provider: ${provider}`)
        }

        if (translatedText && !isLLMTranslateProviderConfig(translateProviderConfig)) {
          translatedText = translatedText.trim()
          setTranslatedText(translatedText === cleanText ? '' : translatedText)
        }
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
    languageConfig.sourceCode,
    languageConfig.targetCode,
    translateProviderConfig,
    isFirefoxExtensionEnv,
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
  const ttsProviderConfig = useAtomValue(ttsProviderConfigAtom)
  const { play, isFetching, isPlaying } = useTextToSpeech()

  const handleSpeak = useCallback(async () => {
    if (!selectionContent) {
      toast.error(i18n.t('speak.noTextSelected'))
      return
    }

    if (!ttsProviderConfig) {
      toast.error(i18n.t('speak.openaiNotConfigured'))
      return
    }

    void play(selectionContent, ttsConfig, ttsProviderConfig)
  }, [selectionContent, ttsConfig, ttsProviderConfig, play])

  if (!ttsProviderConfig) {
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
