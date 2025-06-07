import type { Config } from '../types/config/config'
import type { HighlightData, HighlightState } from '../types/highlight'
import { useCallback, useEffect, useState } from 'react'

import {
  checkHighlightConflicts,
  clearHighlightsFromStorage,
  createHighlightElement,
  DEFAULT_HIGHLIGHT_COLOR,
  generateHighlightId,
  getTextNodeByPath,
  getTextNodePath,
  loadHighlightsFromStorage,
  removeHighlightElement,
  saveHighlightsToStorage,
} from '../utils/highlight'
import {
  copyHighlightsToClipboard,
  copyPromptToClipboard,
  exportHighlightsAsPrompt,
  generateAIPrompt,
  getTextContext,
  importHighlightExplanations,
  readExplanationFromClipboard,
} from '../utils/highlight-prompt'

export interface UseHighlighterOptions {
  enabled?: boolean
  containerSelector?: string
  onHighlightCreated?: (highlight: HighlightData) => void
  onHighlightRemoved?: (id: string) => void
}

export function useHighlighter(options: UseHighlighterOptions = {}) {
  const {
    enabled = true,
    containerSelector = 'body',
    onHighlightCreated,
    onHighlightRemoved,
  } = options

  const [isActive, setIsActive] = useState(enabled)
  const [highlights, setHighlights] = useState<HighlightState[]>([])
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR)
  const [conflictMessage, setConflictMessage] = useState('')
  const [highlightData, setHighlightData] = useState<HighlightData[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // 创建单元素高亮
  const createSingleElementHighlight = useCallback((
    range: Range,
    text: string,
    color: string,
    id: string,
    isRestoringMode: boolean = false,
    restoredHighlights?: HighlightState[],
  ) => {
    const span = createHighlightElement(color, id)
    range.surroundContents(span)

    const newHighlight: HighlightState = {
      id,
      text,
      element: span,
    }

    if (isRestoringMode && restoredHighlights) {
      restoredHighlights.push(newHighlight)
    }
    else if (!isRestoringMode) {
      setHighlights(prev => [...prev, newHighlight])
    }
  }, [])

  // 创建分段高亮
  const createSegmentedHighlight = useCallback((
    range: Range,
    text: string,
    color: string,
    id: string,
    isRestoringMode: boolean = false,
    restoredHighlights?: HighlightState[],
  ) => {
    const segments: HTMLElement[] = []

    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return range.intersectsNode(node) && !!node?.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        },
      },
    )

    const textNodes: Text[] = []
    let currentNode = walker.nextNode() as Text
    while (currentNode) {
      textNodes.push(currentNode)
      currentNode = walker.nextNode() as Text
    }

    textNodes.forEach((textNode, index) => {
      let startOffset = 0
      let endOffset = textNode.textContent?.length || 0

      if (textNode === range.startContainer) {
        startOffset = range.startOffset
      }
      if (textNode === range.endContainer) {
        endOffset = range.endOffset
      }

      if (startOffset < endOffset) {
        const segmentRange = document.createRange()
        segmentRange.setStart(textNode, startOffset)
        segmentRange.setEnd(textNode, endOffset)

        const span = createHighlightElement(color, id, true, index)
        segmentRange.surroundContents(span)
        segments.push(span)
      }
    })

    const newHighlight: HighlightState = {
      id,
      text,
      element: segments[0],
      segments,
    }

    if (isRestoringMode && restoredHighlights) {
      restoredHighlights.push(newHighlight)
    }
    else if (!isRestoringMode) {
      setHighlights(prev => [...prev, newHighlight])
    }
  }, [])

  // 从 Range 创建高亮（支持持久化恢复）
  const createHighlightFromRange = useCallback((
    range: Range,
    text: string,
    color: string,
    id: string,
    isRestoringMode: boolean = false,
    restoredHighlights?: HighlightState[],
  ) => {
    if (range.startContainer === range.endContainer) {
      createSingleElementHighlight(range, text, color, id, isRestoringMode, restoredHighlights)
    }
    else {
      createSegmentedHighlight(range, text, color, id, isRestoringMode, restoredHighlights)
    }
  }, [createSingleElementHighlight, createSegmentedHighlight])

  // 从存储的数据恢复高亮
  const restoreHighlights = useCallback(async (highlightDataList: HighlightData[]) => {
    const container = document.querySelector(containerSelector)
    if (!container) {
      console.error(`Container not found: ${containerSelector}`)
      return
    }

    const restoredHighlights: HighlightState[] = []

    for (const data of highlightDataList) {
      try {
        const startNode = getTextNodeByPath(data.startPath, container as Element)
        const endNode = getTextNodeByPath(data.endPath, container as Element)

        if (startNode && endNode) {
          // 验证偏移量是否有效
          const startTextLength = startNode.textContent?.length || 0
          const endTextLength = endNode.textContent?.length || 0

          // 检查偏移量是否超出文本节点长度
          if (data.startOffset > startTextLength) {
            console.warn(`Failed to restore highlight ${data.id}: start offset ${data.startOffset} exceeds node length ${startTextLength}`)
            continue
          }

          if (data.endOffset > endTextLength) {
            console.warn(`Failed to restore highlight ${data.id}: end offset ${data.endOffset} exceeds node length ${endTextLength}`)
            continue
          }

          const range = document.createRange()
          range.setStart(startNode, data.startOffset)
          range.setEnd(endNode, data.endOffset)

          createHighlightFromRange(range, data.text, data.color, data.id, true, restoredHighlights)
        }
        else {
          console.warn(`Failed to restore highlight ${data.id}: text nodes not found`)
        }
      }
      catch (error) {
        console.error(`Failed to restore highlight ${data.id}:`, error)
      }
    }

    if (restoredHighlights.length > 0) {
      setHighlights(restoredHighlights)
    }
  }, [containerSelector, createHighlightFromRange])

  // 创建高亮（用户选择时调用）
  const createHighlight = useCallback((range: Range, text: string) => {
    const conflictCheck = checkHighlightConflicts(range)
    if (conflictCheck.hasConflict) {
      setConflictMessage(conflictCheck.reason || 'Selection range has conflicts')
      setTimeout(() => setConflictMessage(''), 3000)
      return
    }

    const highlightId = generateHighlightId()
    const containerDom = document.querySelector(containerSelector)
    if (!containerDom) {
      console.error(`Container not found: ${containerSelector}`)
      return
    }

    // 获取上下文
    let context: string = text
    try {
      context = getTextContext(containerDom as HTMLElement, text)
    }
    catch (error) {
      console.warn('Failed to get context for highlight:', error)
    }

    const originalData: HighlightData = {
      id: highlightId,
      text,
      color: highlightColor,
      timestamp: Date.now(),
      selector: containerSelector,
      startPath: getTextNodePath(range.startContainer, containerDom as Element),
      startOffset: range.startOffset,
      endPath: getTextNodePath(range.endContainer, containerDom as Element),
      endOffset: range.endOffset,
      isSegmented: range.startContainer !== range.endContainer,
      context, // 在创建时就获取上下文
    }

    createHighlightFromRange(range, text, highlightColor, highlightId)

    // 保存到存储
    loadHighlightsFromStorage().then((stored) => {
      const updatedData = [...stored, originalData]
      saveHighlightsToStorage(updatedData)
      onHighlightCreated?.(originalData)
    })
  }, [highlightColor, containerSelector, onHighlightCreated, createHighlightFromRange])

  // 移除高亮
  const removeHighlight = useCallback((id: string) => {
    const highlight = highlights.find(h => h.id === id)
    if (!highlight)
      return

    if (highlight.segments && highlight.segments.length > 0) {
      highlight.segments.forEach((segment) => {
        removeHighlightElement(segment)
      })
    }
    else {
      removeHighlightElement(highlight.element)
    }

    setHighlights(prev => prev.filter(h => h.id !== id))

    // 从存储中移除
    setTimeout(() => {
      loadHighlightsFromStorage().then((stored) => {
        const filteredData = stored.filter(data => data.id !== id)
        saveHighlightsToStorage(filteredData)
        onHighlightRemoved?.(id)
      })
    }, 100)
  }, [highlights, onHighlightRemoved])

  // 移除所有高亮
  const removeAllHighlights = useCallback(() => {
    highlights.forEach((highlight) => {
      if (highlight.segments && highlight.segments.length > 0) {
        highlight.segments.forEach((segment) => {
          removeHighlightElement(segment)
        })
      }
      else {
        removeHighlightElement(highlight.element)
      }
    })
    setHighlights([])
    clearHighlightsFromStorage()
  }, [highlights])

  // 更改高亮颜色
  const changeHighlightColor = useCallback((color: string) => {
    setHighlightColor(color)
  }, [])

  // 切换扩展状态
  const toggleActive = useCallback(() => {
    setIsActive(!isActive)
  }, [isActive])

  // 复制 highlights 为 AI prompt 到剪贴板
  const copyPrompt = useCallback(async () => {
    setIsExporting(true)
    try {
      const stored = await loadHighlightsFromStorage()
      if (stored.length === 0) {
        throw new Error('No highlights found to export')
      }

      const promptExport = exportHighlightsAsPrompt(stored, containerSelector)
      await copyPromptToClipboard(promptExport)

      return promptExport
    }
    catch (error) {
      console.error('Failed to copy prompt:', error)
      throw error
    }
    finally {
      setIsExporting(false)
    }
  }, [containerSelector])

  // 复制 highlights 数据到剪贴板
  const copyHighlightsData = useCallback(async () => {
    setIsExporting(true)
    try {
      const stored = await loadHighlightsFromStorage()
      if (stored.length === 0) {
        throw new Error('No highlights found to export')
      }

      await copyHighlightsToClipboard(stored)
    }
    catch (error) {
      console.error('Failed to copy highlights data:', error)
      throw error
    }
    finally {
      setIsExporting(false)
    }
  }, [])

  // 从剪贴板导入 AI 解释结果
  const importExplanationsFromClipboard = useCallback(async () => {
    setIsImporting(true)
    try {
      const explanations = await readExplanationFromClipboard()
      const stored = await loadHighlightsFromStorage()

      const updatedHighlights = importHighlightExplanations(explanations, stored)
      await saveHighlightsToStorage(updatedHighlights)

      setHighlightData(updatedHighlights)

      // 重新恢复 highlights 以显示更新的数据
      if (isActive) {
        restoreHighlights(updatedHighlights)
      }

      return explanations.length
    }
    catch (error) {
      console.error('Failed to import explanations:', error)
      throw error
    }
    finally {
      setIsImporting(false)
    }
  }, [isActive, restoreHighlights])

  // 使用配置的AI模型直接生成解释
  const generateExplanations = useCallback(async () => {
    setIsGenerating(true)
    try {
      const stored = await loadHighlightsFromStorage()
      if (stored.length === 0) {
        throw new Error('No highlights found to generate explanations')
      }

      // 生成 AI prompt
      const promptExport = exportHighlightsAsPrompt(stored, containerSelector)
      const aiPrompt = generateAIPrompt(promptExport)

      // 获取配置
      const { CONFIG_STORAGE_KEY } = await import('../utils/constants/config')
      const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)

      if (!config?.read?.provider || !config.read.models[config.read.provider]) {
        throw new Error('No AI model configured. Please set up read provider in options.')
      }

      const provider = config.read.provider
      const modelConfig = config.read.models[provider]

      if (!modelConfig) {
        throw new Error('No model configuration found for the selected provider')
      }

      const modelString = modelConfig.isCustomModel ? modelConfig.customModel : modelConfig.model

      if (!modelString) {
        throw new Error('No model string available for explanation generation')
      }

      // 导入 AI 相关模块
      const { generateText } = await import('ai')
      const { getReadModel } = await import('../utils/provider')

      const model = await getReadModel(provider, modelString)

      // 调用 AI 生成解释
      const { text } = await generateText({
        model,
        prompt: aiPrompt,
      })

      // 解析 AI 返回的 JSON 数据
      let explanations
      try {
        // 尝试直接解析
        explanations = JSON.parse(text)
      }
      catch {
        // 尝试从 markdown 代码块中提取
        const jsonMatch = text.match(/```json([\s\S]*?)```/)
        if (jsonMatch) {
          explanations = JSON.parse(jsonMatch[1].trim())
        }
        else {
          throw new Error('Failed to parse AI response as JSON')
        }
      }

      // 导入解释数据
      const updatedHighlights = importHighlightExplanations(explanations, stored)
      await saveHighlightsToStorage(updatedHighlights)

      setHighlightData(updatedHighlights)

      // 重新恢复 highlights 以显示更新的数据
      if (isActive) {
        restoreHighlights(updatedHighlights)
      }

      return explanations.length
    }
    catch (error) {
      console.error('Failed to generate explanations:', error)
      throw error
    }
    finally {
      setIsGenerating(false)
    }
  }, [containerSelector, isActive, restoreHighlights])

  // 获取当前 highlight 数据（包含解释）
  const getHighlightData = useCallback(async () => {
    const stored = await loadHighlightsFromStorage()
    setHighlightData(stored)
    return stored
  }, [])

  // 页面加载时恢复高亮数据
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        loadHighlightsFromStorage().then((stored) => {
          if (stored.length > 0) {
            restoreHighlights(stored)
          }
        })
      }, 500)

      return () => clearTimeout(timer)
    }
    else {
      highlights.forEach((highlight) => {
        if (highlight.segments && highlight.segments.length > 0) {
          highlight.segments.forEach((segment) => {
            removeHighlightElement(segment)
          })
        }
        else {
          removeHighlightElement(highlight.element)
        }
      })
    }
  }, [isActive, restoreHighlights, highlights])

  return {
    isActive,
    highlights,
    highlightColor,
    conflictMessage,
    highlightData,
    isExporting,
    isImporting,
    isGenerating,
    createHighlight,
    removeHighlight,
    removeAllHighlights,
    changeHighlightColor,
    toggleActive,
    setConflictMessage,
    copyPrompt,
    copyHighlightsData,
    importExplanationsFromClipboard,
    generateExplanations,
    getHighlightData,
  }
}
