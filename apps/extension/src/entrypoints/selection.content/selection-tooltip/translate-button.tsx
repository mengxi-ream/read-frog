import type { TextUIPart } from 'ai'
import { Icon } from '@iconify/react'
import { readUIMessageStream, streamText } from 'ai'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ISO6393_TO_6391, LANG_CODE_TO_EN_NAME } from '@/types/config/languages'
import { isPureTranslateProvider } from '@/types/config/provider'
import { globalConfig } from '@/utils/config/config'
import { deeplxTranslate, googleTranslate, microsoftTranslate } from '@/utils/host/translate/api'
import { getTranslatePrompt } from '@/utils/prompts/translate'
import { getTranslateModel } from '@/utils/provider'
import { isTooltipVisibleAtom, isTranslatePopoverVisibleAtom, mouseClickPositionAtom, selectionContentAtom } from './atom'

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
  const [isVisible, setIsVisible] = useAtom(isTranslatePopoverVisibleAtom)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | undefined>(undefined)
  const mouseClickPosition = useAtomValue(mouseClickPositionAtom)
  const selectionContent = useAtomValue(selectionContentAtom)
  const popoverRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTranslatedText(undefined)
  }, [setIsVisible])

  const handleCopy = useCallback(() => {
    if (translatedText) {
      navigator.clipboard.writeText(translatedText)
    }
  }, [translatedText])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current) {
        const eventPath = event.composedPath()
        const isClickInsideTooltip = eventPath.includes(popoverRef.current)
        if (!isClickInsideTooltip) {
          handleClose()
        }
      }
    }

    const translate = async () => {
      if (!selectionContent) {
        return
      }

      if (!globalConfig) {
        throw new Error('No global config when translate text')
      }
      const provider = globalConfig.translate.provider
      const modelConfig = globalConfig.translate.models[provider]
      if (!modelConfig && !isPureTranslateProvider(provider)) {
        throw new Error(`No configuration found for provider: ${provider}`)
      }
      const modelString = modelConfig?.isCustomModel ? modelConfig.customModel : modelConfig?.model

      setIsTranslating(true)
      if (isPureTranslateProvider(provider)) {
        const sourceLang = globalConfig.language.sourceCode === 'auto' ? 'auto' : (ISO6393_TO_6391[globalConfig.language.sourceCode] ?? 'auto')
        const targetLang = ISO6393_TO_6391[globalConfig.language.targetCode]
        if (!targetLang) {
          throw new Error('Invalid target language code')
        }
        if (provider === 'google') {
          setTranslatedText(await googleTranslate(selectionContent, sourceLang, targetLang))
        }
        else if (provider === 'microsoft') {
          setTranslatedText(await microsoftTranslate(selectionContent, sourceLang, targetLang))
        }
        else if (provider === 'deeplx') {
          setTranslatedText(await deeplxTranslate(selectionContent, sourceLang, targetLang))
        }
      }
      else if (modelString) {
        const targetLang = LANG_CODE_TO_EN_NAME[globalConfig.language.targetCode]
        if (!targetLang) {
          throw new Error('Invalid target language code')
        }
        const prompt = getTranslatePrompt(targetLang, selectionContent)
        const model = await getTranslateModel(provider, modelString)
        const result = streamText({
          model,
          prompt,
        })
        for await (const uiMessage of readUIMessageStream({
          stream: result.toUIMessageStream(),
        })) {
          setTranslatedText((uiMessage.parts[uiMessage.parts.length - 1] as TextUIPart).text)
        }
      }

      setIsTranslating(false)
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      translate()
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, selectionContent, handleClose])

  if (!isVisible || !mouseClickPosition || !selectionContent) {
    return null
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-[2147483647] bg-white dark:bg-zinc-800 border rounded-lg w-[300px] shadow-lg"
      style={{
        left: mouseClickPosition.x,
        top: mouseClickPosition.y,
      }}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Icon icon="ri:translate" strokeWidth={0.8} className="size-4.5 text-zinc-600 dark:text-zinc-400" />
          <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">Translation</h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <Icon icon="tabler:x" strokeWidth={1} className="size-4 text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
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
      <div className="p-4 flex justify-end items-center">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <Icon icon="tabler:copy" strokeWidth={1} className="size-4 text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>
    </div>
  )
}
