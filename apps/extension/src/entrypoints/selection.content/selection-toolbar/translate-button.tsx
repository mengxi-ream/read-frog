import type { TextUIPart } from 'ai'
import { Icon } from '@iconify/react'
import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME } from '@repo/definitions'
import { useMutation } from '@tanstack/react-query'
import { readUIMessageStream, streamText } from 'ai'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { isLLMTranslateProviderConfig, isNonAPIProvider, isPureAPIProvider } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { translateProviderConfigAtom } from '@/utils/atoms/provider'
import { authClient } from '@/utils/auth/auth-client'
import { getConfigFromStorage } from '@/utils/config/config'
import { getProviderOptions } from '@/utils/constants/model'
import { WEBSITE_URL } from '@/utils/constants/url'
import { deeplxTranslate, googleTranslate, microsoftTranslate } from '@/utils/host/translate/api'
import { sendMessage } from '@/utils/message'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModelById } from '@/utils/providers/model'
import { trpc } from '@/utils/trpc/client'
import { isTooltipVisibleAtom, isTranslatePopoverVisibleAtom, mouseClickPositionAtom, selectionContentAtom } from './atom'
import { PopoverWrapper } from './components/popover-wrapper'

export function TranslateButton() {
  // const selectionContent = useAtomValue(selectionContentAtom)
  const setIsTooltipVisible = useSetAtom(isTooltipVisibleAtom)
  const setIsTranslatePopoverVisible = useSetAtom(isTranslatePopoverVisibleAtom)
  const setMousePosition = useSetAtom(mouseClickPositionAtom)

  const handleClick = async (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left
    const y = rect.top

    setMousePosition({ x, y })
    setIsTooltipVisible(false)
    setIsTranslatePopoverVisible(true)
  }

  return (
    <button type="button" className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer" onClick={handleClick}>
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
  const { data: session } = authClient.useSession()

  const createVocabulary = useMutation({
    ...trpc.vocabulary.create.mutationOptions(),
    onSuccess: () => {
      toast.success(`Translation saved successfully! Please go to ${WEBSITE_URL}/vocabulary to view it.`)
    },
  })

  const handleClose = useCallback(() => {
    setTranslatedText(undefined)
  }, [])

  const handleCopy = useCallback(() => {
    if (translatedText) {
      void navigator.clipboard.writeText(translatedText)
      toast.success('Translation copied to clipboard!')
    }
  }, [translatedText])

  const handleSave = useCallback(async () => {
    if (!session?.user?.id) {
      await sendMessage('openPage', { url: `${WEBSITE_URL}/log-in`, active: true })
      return
    }

    if (!selectionContent || !translatedText) {
      toast.error('No content to save')
      return
    }

    const config = await getConfigFromStorage()
    if (!config) {
      toast.error('Configuration not loaded')
      return
    }

    try {
      await createVocabulary.mutateAsync({
        originalText: selectionContent,
        translation: translatedText,
        sourceLanguageISO6393: config.language.sourceCode === 'auto' ? 'eng' : config.language.sourceCode,
        targetLanguageISO6393: config.language.targetCode,
      })
    }
    catch {
      // Error handled by mutation
    }
  }, [session?.user?.id, selectionContent, translatedText, createVocabulary])

  useEffect(() => {
    const translate = async () => {
      const cleanText = selectionContent?.replace(/\u200B/g, '').trim()
      if (!cleanText) {
        return
      }

      const config = await getConfigFromStorage()
      if (!config) {
        throw new Error('No global config when translate text')
      }

      if (!translateProviderConfig) {
        throw new Error(`No provider config for ${config.translate.providerId} when translate text`)
      }

      const { provider } = translateProviderConfig

      setIsTranslating(true)

      try {
        let translatedText = ''

        if (isNonAPIProvider(provider)) {
          const sourceLang = languageConfig.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[languageConfig.sourceCode] ?? 'auto')
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
          const sourceLang = languageConfig.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[languageConfig.sourceCode] ?? 'auto')
          const targetLang = ISO6393_TO_6391[languageConfig.targetCode]
          if (!targetLang) {
            throw new Error(`Invalid target language code: ${languageConfig.targetCode}`)
          }

          if (provider === 'deeplx') {
            translatedText = await deeplxTranslate(cleanText, sourceLang, targetLang, translateProviderConfig, { forceBackgroundFetch: true })
          }
        }
        else if (isLLMTranslateProviderConfig(translateProviderConfig)) {
          const targetLangName = LANG_CODE_TO_EN_NAME[languageConfig.targetCode]
          const { id: providerId, models: { translate } } = translateProviderConfig
          const translateModel = translate.isCustomModel ? translate.customModel : translate.model
          const model = await getTranslateModelById(providerId)

          // Configure ultrathink for thinking models
          const providerOptions = getProviderOptions(translateModel ?? '')
          const prompt = await getTranslatePrompt(targetLangName, cleanText)

          // Use streaming for AI providers
          const result = streamText({
            model,
            prompt,
            providerOptions,
          })

          for await (const uiMessage of readUIMessageStream({
            stream: result.toUIMessageStream(),
          })) {
            const lastPart = uiMessage.parts[uiMessage.parts.length - 1] as TextUIPart
            setTranslatedText(lastPart.text)
          }
        }
        else {
          throw new Error(`Unknown provider: ${provider}`)
        }

        // Set final text if not streaming
        if (translatedText && !isLLMTranslateProviderConfig(translateProviderConfig)) {
          translatedText = translatedText.trim()
          setTranslatedText(translatedText === cleanText ? '' : translatedText)
        }
      }
      catch (error) {
        console.error('Translation error:', error)
        toast.error('Translation failed')
      }
      finally {
        setIsTranslating(false)
      }
    }

    if (isVisible) {
      void translate()
    }
  }, [isVisible, selectionContent, languageConfig.sourceCode, languageConfig.targetCode, translateProviderConfig])

  return (
    <PopoverWrapper
      title="Translation"
      icon="ri:translate"
      onClose={handleClose}
      isVisible={isVisible}
      setIsVisible={setIsVisible}
    >
      <div className="p-4 border-b">
        <div className="border-b pb-4"><p className="text-sm text-zinc-600 dark:text-zinc-400">{selectionContent}</p></div>
        <div className="pt-4">
          <p className="text-sm">
            {isTranslating && !translatedText && <Icon icon="svg-spinners:3-dots-bounce" />}
            {translatedText}
            {isTranslating && translatedText && ' ●'}
          </p>
        </div>
      </div>
      <div className="p-4 flex justify-between items-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={!translatedText || createVocabulary.isPending}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm rounded"
        >
          {createVocabulary.isPending
            ? (
                <Icon icon="svg-spinners:3-dots-bounce" className="size-4" />
              )
            : (
                <Icon icon="tabler:bookmark-plus" strokeWidth={1} className="size-4" />
              )}
          {createVocabulary.isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <Icon icon="tabler:copy" strokeWidth={1} className="size-4 text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    </PopoverWrapper>
  )
}
