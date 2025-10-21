import type { PopoverWrapperRef } from './components/popover-wrapper'
import { useMemo, useRef, useState } from '#imports'
import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { streamText } from 'ai'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Activity } from 'react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { configAtom, configFieldsAtomMap } from '@/utils/atoms/config'
import { readProviderConfigAtom } from '@/utils/atoms/provider'
import { getFinalSourceCode } from '@/utils/config/languages'
import { logger } from '@/utils/logger'
import { getWordExplainPrompt } from '@/utils/prompts/word-explain'
import { getReadModelById } from '@/utils/providers/model'
import { createHighlightData } from '../utils'
import { isAiPopoverVisibleAtom, isSelectionToolbarVisibleAtom, mouseClickPositionAtom, selectionRangeAtom } from './atom'
import { PopoverWrapper } from './components/popover-wrapper'

export function AiButton() {
  const setIsSelectionToolbarVisible = useSetAtom(isSelectionToolbarVisibleAtom)
  const setIsAiPopoverVisible = useSetAtom(isAiPopoverVisibleAtom)
  const setMousePosition = useSetAtom(mouseClickPositionAtom)
  const betaExperienceConfig = useAtomValue(configFieldsAtomMap.betaExperience)

  const handleClick = async (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left
    const y = rect.top

    setMousePosition({ x, y })
    setIsSelectionToolbarVisible(false)
    setIsAiPopoverVisible(true)
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (!import.meta.env.DEV && !betaExperienceConfig.enabled) {
    return null
  }

  return (
    <button type="button" className="size-6 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer" onClick={handleClick}>
      <Icon icon="tabler:zoom-scan" strokeWidth={0.8} className="size-4" />
    </button>
  )
}

export function AiPopover() {
  const [isVisible, setIsVisible] = useAtom(isAiPopoverVisibleAtom)
  const selectionRange = useAtomValue(selectionRangeAtom)
  const config = useAtomValue(configAtom)
  const readProviderConfig = useAtomValue(readProviderConfigAtom)
  const popoverRef = useRef<PopoverWrapperRef>(null)
  const [aiResponse, setAiResponse] = useState('')

  const highlightData = useMemo(() => {
    if (!selectionRange || !isVisible) {
      return null
    }
    const data = createHighlightData(selectionRange)
    logger.info('highlightData.context', '\n', data.context)
    return data
  }, [selectionRange, isVisible])

  const {
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      'analyzeSelection',
      highlightData,
      readProviderConfig,
      config,
    ],
    queryFn: async () => {
      if (!highlightData || !readProviderConfig || !config) {
        throw new Error('AI配置未找到或没有选中内容')
      }

      setAiResponse('')

      const model = await getReadModelById(readProviderConfig.id)
      const actualSourceCode = getFinalSourceCode(config.language.sourceCode, config.language.detectedCode)
      const systemPrompt = getWordExplainPrompt(
        actualSourceCode,
        config.language.targetCode,
        config.language.level,
      )

      const result = await streamText({
        model,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content:
              `query: ${highlightData.context.selection}\n`
              + `context: ${highlightData.context.before} ${highlightData.context.selection} ${highlightData.context.after}`,
          },
        ],
      })

      let fullResponse = ''
      for await (const delta of result.textStream) {
        fullResponse += delta
        setAiResponse(fullResponse)
        popoverRef.current?.scrollToBottom()
      }

      logger.log('aiResponse', '\n', fullResponse)

      return true
    },
    enabled: !!highlightData,
  })

  return (
    <PopoverWrapper
      ref={popoverRef}
      title="AI"
      icon="hugeicons:ai-innovation-02"
      isVisible={isVisible}
      setIsVisible={setIsVisible}
    >
      <div className="p-4 border-b pt-0">
        <div className="border-b pb-4 sticky pt-4 top-0 bg-white dark:bg-zinc-800 z-10">
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">上下文:</p>
          <div className="text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 p-3 rounded leading-relaxed">
            {highlightData?.context.before && (
              <span>
                {highlightData.context.before}
              </span>
            )}
            {highlightData?.context.selection && (
              <span
                className="font-medium"
                style={{ color: 'var(--read-frog-primary)' }}
              >
                {` ${highlightData.context.selection} `}
              </span>
            )}
            {highlightData?.context.after && (
              <span>
                {highlightData.context.after}
              </span>
            )}
          </div>
        </div>
        <div className="pt-4">
          <Activity mode={isLoading && !aiResponse ? 'visible' : 'hidden'}>
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-3 text-slate-500">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm font-medium">AI正在分析中...</span>
              </div>
            </div>
          </Activity>

          <Activity mode={error ? 'visible' : 'hidden'}>
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

          <Activity mode={aiResponse ? 'visible' : 'hidden'}>
            <div className="rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <MarkdownRenderer content={aiResponse} />
            </div>
          </Activity>
        </div>
      </div>
    </PopoverWrapper>
  )
}
