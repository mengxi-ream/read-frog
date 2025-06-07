import type { AnkiConnectConfig, AnkiConnectResponse, AnkiNote, AnkiRequest, HighlightToAnkiOptions } from '@/types/anki'
import type { HighlightData } from '@/types/highlight'
import { sendMessage } from './message'

// 默认 AnkiConnect 配置
export const DEFAULT_ANKI_CONFIG: AnkiConnectConfig = {
  url: 'http://127.0.0.1:8765',
  version: 6,
}

// 默认 Anki 配置
export const DEFAULT_ANKI_OPTIONS: HighlightToAnkiOptions = {
  deckName: 'Test',
  modelName: '问题模板',
  includePronunciation: true,
  includeExamples: true,
  includeContext: true,
  includeLink: true,
}

/**
 * 向 AnkiConnect 发送请求
 */
export async function sendAnkiRequest<T = any>(
  action: string,
  params: Record<string, any> = {},
  config: AnkiConnectConfig = DEFAULT_ANKI_CONFIG,
): Promise<AnkiConnectResponse<T>> {
  const request: AnkiRequest = {
    action: action as any,
    version: config.version,
    params,
  }

  try {
    // 检查是否在扩展环境中
    if ((globalThis as any).browser?.runtime || (globalThis as any).chrome?.runtime) {
      // 在扩展环境中，尝试通过 background script 发送请求
      try {
        const response = await sendRequestThroughBackground(config.url, request)
        return response
      }
      catch (backgroundError) {
        console.warn('Background request failed, trying direct fetch:', backgroundError)
        // 如果 background 请求失败，回退到直接请求
      }
    }

    // 直接发送请求（可能遇到 CORS 问题）
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: AnkiConnectResponse<T> = await response.json()

    if (result.error) {
      throw new Error(`AnkiConnect error: ${result.error}`)
    }

    return result
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('CORS')) {
      throw new Error(
        `CORS error: Please configure AnkiConnect to allow requests from your domain. `
        + `Add your domain to the 'webCorsOriginList' in AnkiConnect config, or install the browser extension version.`,
      )
    }
    throw new Error(`Failed to connect to AnkiConnect: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 通过 background script 发送请求（绕过 CORS）
 */
async function sendRequestThroughBackground(url: string, request: AnkiRequest): Promise<any> {
  try {
    // 使用 WXT 的 sendMessage 系统
    const response = await sendMessage('ANKI_REQUEST', { url, request })

    if (response.success) {
      return response.result
    }
    else {
      throw new Error(response.error || 'Unknown error from background script')
    }
  }
  catch (error) {
    throw new Error(`Background request failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 检查 AnkiConnect 是否可用
 */
export async function checkAnkiConnect(config?: AnkiConnectConfig): Promise<boolean> {
  try {
    const response = await sendAnkiRequest('version', {}, config)
    return response.result >= 6
  }
  catch (error) {
    console.error('AnkiConnect not available:', error)
    return false
  }
}

/**
 * 获取所有牌组名称
 */
export async function getDeckNames(config?: AnkiConnectConfig): Promise<string[]> {
  const response = await sendAnkiRequest<string[]>('deckNames', {}, config)
  return response.result
}

/**
 * 获取所有模型名称
 */
export async function getModelNames(config?: AnkiConnectConfig): Promise<string[]> {
  const response = await sendAnkiRequest<string[]>('modelNames', {}, config)
  return response.result
}

/**
 * 获取指定模型的字段名称
 */
export async function getModelFieldNames(modelName: string, config?: AnkiConnectConfig): Promise<string[]> {
  const response = await sendAnkiRequest<string[]>('modelFieldNames', { modelName }, config)
  return response.result
}

/**
 * 请求 Anki 权限
 */
export async function requestAnkiPermission(config?: AnkiConnectConfig): Promise<boolean> {
  try {
    const response = await sendAnkiRequest('requestPermission', {}, config)
    return response.result?.permission === 'granted'
  }
  catch (error) {
    console.error('Failed to request Anki permission:', error)
    return false
  }
}

/**
 * 将高亮数据转换为 Anki 卡片
 */
export function convertHighlightToAnkiNote(
  highlight: HighlightData,
  options: HighlightToAnkiOptions,
): AnkiNote {
  // 构建问题（在上下文中高亮文本，加粗显示）
  const boldContext = highlight.context
    ? highlight.context.replace(
        new RegExp(highlight.text, 'gi'),
        `<b>$&</b>`,
      )
    : `<b>${highlight.text}</b>`

  // 构建答案
  let answer = ''

  if (options.includePronunciation && highlight.pronunciation) {
    answer += `${highlight.pronunciation}<br>`
  }

  if (highlight.explanation) {
    answer += `${highlight.explanation}<br>`
  }

  if (options.includeExamples && highlight.examples && highlight.examples.length > 0) {
    answer += highlight.examples
      .map(example => `- ${example}`)
      .join('<br>')
  }

  // 构建相关知识（链接）
  const relatedKnowledge = options.includeLink && highlight.link
    ? `<a href="${highlight.link}">${highlight.link}</a>`
    : ''

  // 创建 Anki 卡片
  const ankiNote: AnkiNote = {
    deckName: options.deckName,
    modelName: options.modelName,
    fields: {
      问题: boldContext,
      答案: answer.trim(),
      相关知识: relatedKnowledge,
    },
    options: {
      allowDuplicate: false,
      duplicateScope: 'deck',
    },
  }

  return ankiNote
}

/**
 * 添加单个 Anki 卡片
 */
export async function addAnkiNote(
  note: AnkiNote,
  config?: AnkiConnectConfig,
): Promise<number> {
  const response = await sendAnkiRequest<number>('addNote', { note }, config)
  return response.result
}

/**
 * 批量添加 Anki 卡片
 */
export async function addAnkiNotes(
  notes: AnkiNote[],
  config?: AnkiConnectConfig,
): Promise<number[]> {
  const response = await sendAnkiRequest<number[]>('addNotes', { notes }, config)
  return response.result
}

/**
 * 检查卡片是否可以添加（去重检查）
 */
export async function canAddNotes(
  notes: AnkiNote[],
  config?: AnkiConnectConfig,
): Promise<boolean[]> {
  const response = await sendAnkiRequest<boolean[]>('canAddNotes', { notes }, config)
  return response.result
}

/**
 * 将高亮数据批量转换并添加到 Anki
 */
export async function exportHighlightsToAnki(
  highlights: HighlightData[],
  options: HighlightToAnkiOptions,
  config?: AnkiConnectConfig,
): Promise<{ added: number, failed: number, errors: string[], exportedHighlightIds: string[] }> {
  // 筛选有解释的高亮
  const highlightsWithExplanations = highlights.filter(h => h.explanation)

  // 转换为 Anki 卡片
  const ankiNotes = highlightsWithExplanations.map(h => convertHighlightToAnkiNote(h, options))

  if (ankiNotes.length === 0) {
    throw new Error('No highlights with explanations found to export to Anki.')
  }

  // 批量添加
  try {
    const results = await addAnkiNotes(ankiNotes, config)
    const added = results.filter(id => id !== null).length
    const failed = results.length - added

    // 获取成功导出的高亮 ID
    const exportedHighlightIds: string[] = []
    results.forEach((result, index) => {
      if (result !== null) {
        exportedHighlightIds.push(highlightsWithExplanations[index].id)
      }
    })

    return {
      added,
      failed,
      errors: [],
      exportedHighlightIds,
    }
  }
  catch (error) {
    throw new Error(`Failed to add notes to Anki: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * 获取 Anki 配置的存储键
 */
export const ANKI_CONFIG_STORAGE_KEY = 'anki-config'

/**
 * 从存储中加载 Anki 配置
 */
export async function loadAnkiConfig(): Promise<HighlightToAnkiOptions> {
  try {
    const stored = localStorage.getItem(ANKI_CONFIG_STORAGE_KEY)
    if (stored) {
      const config = JSON.parse(stored) as HighlightToAnkiOptions
      return { ...DEFAULT_ANKI_OPTIONS, ...config }
    }
  }
  catch (error) {
    console.error('Failed to load Anki config:', error)
  }
  return DEFAULT_ANKI_OPTIONS
}

/**
 * 保存 Anki 配置到存储
 */
export async function saveAnkiConfig(config: HighlightToAnkiOptions): Promise<void> {
  try {
    localStorage.setItem(ANKI_CONFIG_STORAGE_KEY, JSON.stringify(config))
  }
  catch (error) {
    console.error('Failed to save Anki config:', error)
  }
}
