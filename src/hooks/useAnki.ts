import type { HighlightToAnkiOptions } from '@/types/anki'
import type { HighlightData } from '@/types/highlight'
import { useCallback, useState } from 'react'
import {
  checkAnkiConnect,
  DEFAULT_ANKI_OPTIONS,
  exportHighlightsToAnki,
  getDeckNames,
  getModelNames,
  loadAnkiConfig,
  saveAnkiConfig,
} from '@/utils/anki'
import { loadHighlightsFromStorage, saveHighlightsToStorage } from '@/utils/highlight'

export interface UseAnkiOptions {
  autoConnect?: boolean
}

export function useAnki(options: UseAnkiOptions = {}) {
  const { autoConnect = true } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState<HighlightToAnkiOptions>(DEFAULT_ANKI_OPTIONS)
  const [availableDecks, setAvailableDecks] = useState<string[]>([])
  const [availableModels, setAvailableModels] = useState<string[]>([])

  // 检查 AnkiConnect 连接
  const checkConnection = useCallback(async () => {
    setIsLoading(true)
    try {
      const connected = await checkAnkiConnect()
      setIsConnected(connected)
      return connected
    }
    catch (error) {
      console.error('Failed to check AnkiConnect:', error)
      setIsConnected(false)
      return false
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  // 加载 Anki 配置
  const loadConfig = useCallback(async () => {
    try {
      const savedConfig = await loadAnkiConfig()
      setConfig(savedConfig)
      return savedConfig
    }
    catch (error) {
      console.error('Failed to load Anki config:', error)
      return DEFAULT_ANKI_OPTIONS
    }
  }, [])

  // 保存 Anki 配置
  const updateConfig = useCallback(async (newConfig: Partial<HighlightToAnkiOptions>) => {
    const updatedConfig = { ...config, ...newConfig }
    setConfig(updatedConfig)
    await saveAnkiConfig(updatedConfig)
    return updatedConfig
  }, [config])

  // 获取可用的牌组
  const fetchAvailableDecks = useCallback(async () => {
    setIsLoading(true)
    try {
      const decks = await getDeckNames()
      setAvailableDecks(decks)
      return decks
    }
    catch (error) {
      console.error('Failed to fetch available decks:', error)
      setAvailableDecks([])
      throw error
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  // 获取可用的模型
  const fetchAvailableModels = useCallback(async () => {
    setIsLoading(true)
    try {
      const models = await getModelNames()
      setAvailableModels(models)
      return models
    }
    catch (error) {
      console.error('Failed to fetch available models:', error)
      setAvailableModels([])
      throw error
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  // 导出高亮到 Anki
  const exportToAnki = useCallback(async (highlights?: HighlightData[]) => {
    setIsExporting(true)
    try {
      // 如果没有提供高亮数据，从存储中加载
      const highlightsToExport = highlights || await loadHighlightsFromStorage()

      if (highlightsToExport.length === 0) {
        throw new Error('No highlights found to export')
      }

      // 执行导出
      const result = await exportHighlightsToAnki(highlightsToExport, config)

      // 如果有成功导出的高亮，从存储中删除它们
      if (result.exportedHighlightIds.length > 0) {
        const remainingHighlights = highlightsToExport.filter(
          h => !result.exportedHighlightIds.includes(h.id),
        )
        await saveHighlightsToStorage(remainingHighlights)
      }

      return result
    }
    catch (error) {
      console.error('Failed to export to Anki:', error)
      throw error
    }
    finally {
      setIsExporting(false)
    }
  }, [config])

  // 导出带解释的高亮到 Anki
  const exportHighlightsWithExplanations = useCallback(async () => {
    const highlights = await loadHighlightsFromStorage()
    const highlightsWithExplanations = highlights.filter(h => h.explanation)

    if (highlightsWithExplanations.length === 0) {
      throw new Error('No highlights with explanations found. Please import AI explanations first.')
    }

    return exportToAnki(highlightsWithExplanations)
  }, [exportToAnki])

  // 初始化 Anki 连接和配置
  const initialize = useCallback(async () => {
    setIsLoading(true)
    try {
      // 并行执行初始化任务
      const [connected, savedConfig] = await Promise.all([
        autoConnect ? checkAnkiConnect() : Promise.resolve(false),
        loadAnkiConfig(),
      ])

      setIsConnected(connected)
      setConfig(savedConfig)

      // 如果连接成功，获取可用的牌组和模型
      if (connected) {
        try {
          const [decks, models] = await Promise.all([
            getDeckNames(),
            getModelNames(),
          ])
          setAvailableDecks(decks)
          setAvailableModels(models)
        }
        catch (error) {
          console.warn('Failed to fetch available decks/models:', error)
        }
      }

      return { connected, config: savedConfig }
    }
    catch (error) {
      console.error('Failed to initialize Anki:', error)
      return { connected: false, config: DEFAULT_ANKI_OPTIONS }
    }
    finally {
      setIsLoading(false)
    }
  }, [autoConnect])

  return {
    // 状态
    isConnected,
    isExporting,
    isLoading,
    config,
    availableDecks,
    availableModels,

    // 方法
    checkConnection,
    loadConfig,
    updateConfig,
    fetchAvailableDecks,
    fetchAvailableModels,
    exportToAnki,
    exportHighlightsWithExplanations,
    initialize,
  }
}
