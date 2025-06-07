import type {
  HighlightData,
  HighlightExplanationData,
  HighlightExplanationImport,
  HighlightPromptData,
  HighlightPromptExport,
} from '../types/highlight'
import nlp from 'compromise'

/**
 * 获取文本节点的上下文（使用自然语言处理）
 */
export function getTextContext(element: HTMLElement, targetText: string): string {
  let container: Element | null = null

  // Try to get container from range's common ancestor
  try {
    const range = document.createRange()
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
    )

    let textNode = walker.nextNode()
    while (textNode) {
      if (textNode.textContent?.includes(targetText)) {
        range.selectNodeContents(textNode)
        container = range.commonAncestorContainer as Element
        if (container.nodeType === Node.TEXT_NODE) {
          container = container.parentElement
        }
        break
      }
      textNode = walker.nextNode()
    }
  }
  catch (error) {
    console.warn('Failed to get range common ancestor:', error)
  }

  // Fallback to closest method if range approach fails
  if (!container) {
    container = element.closest('p, div, h1, h2, h3, h4, h5, h6, pre, td, body')
  }

  if (!container)
    return targetText

  // Get the full context and split into sentences
  const fullContext = container.textContent?.trim() || ''
  const doc = nlp(fullContext)

  // Get all sentences that contain the highlight text
  const sentences = doc
    .sentences()
    .filter((s: any) => s.text().includes(targetText))
    .out('array') as string[]

  const context = sentences.join(' ')
  return context || targetText
}

/**
 * 导出 highlights 为 prompt 格式
 */
export function exportHighlightsAsPrompt(highlights: HighlightData[], containerSelector: string = 'body'): HighlightPromptExport {
  const promptData: HighlightPromptData[] = highlights.map((highlight) => {
    // 使用已存储的上下文，如果没有则回退到高亮文本
    const context = highlight.context || highlight.text

    return {
      highlight: highlight.text,
      context,
      id: highlight.id,
    }
  })

  return {
    highlights: promptData,
    metadata: {
      timestamp: Date.now(),
      totalCount: highlights.length,
      selector: containerSelector,
    },
  }
}

/**
 * 生成用于 AI 的 prompt 文本
 */
export function generateAIPrompt(promptExport: HighlightPromptExport): string {
  const combinedText = promptExport.highlights.map((item, index) => `
${index + 1}. **Highlight**: "${item.highlight}"
   **Context**: "${item.context}"
   **ID**: ${item.id}
`).join('\n')

  return `You are a helpful assistant that explains English vocabulary.
Please explain the highlighted words/phrases from the text below:
- Provide simple definitions in English at this context
- Give 2-3 example sentences for each highlighted word/phrase
- If the context is not complete or wrong, fix it. if the context is to long, adjust it to a reasonable length

${combinedText}

Please return the key points in a JSON format.
The JSON format should be like this:
[
  {
    "highlight": "highlight text",
    "context": "context text",
    "explanation": "explanation text",
    "examples": ["example 1", "example 2"],
    "pronunciation": "美 /ˌpɪktʃə'resk/",
    "link": "link text",
    "id": "highlight_id"
  }
]`
}

/**
 * 导入 AI 解释结果
 */
export function importHighlightExplanations(
  explanationData: HighlightExplanationData[] | HighlightExplanationImport,
  existingHighlights: HighlightData[],
): HighlightData[] {
  const explanations = Array.isArray(explanationData)
    ? explanationData
    : explanationData.explanations

  const highlightMap = new Map(existingHighlights.map(h => [h.id, h]))

  // 更新现有 highlights 的解释信息
  explanations.forEach((explanation) => {
    // 首先尝试通过 ID 匹配
    if (explanation.id && highlightMap.has(explanation.id)) {
      const highlight = highlightMap.get(explanation.id)!
      updateHighlightWithExplanation(highlight, explanation)
      return
    }

    // 如果没有 ID，尝试通过文本匹配
    const matchingHighlight = existingHighlights.find(h =>
      h.text.toLowerCase().trim() === explanation.highlight.toLowerCase().trim(),
    )

    if (matchingHighlight) {
      updateHighlightWithExplanation(matchingHighlight, explanation)
    }
    else {
      console.warn('No matching highlight found for:', explanation.highlight)
    }
  })

  return existingHighlights
}

/**
 * 更新 highlight 的解释信息
 */
function updateHighlightWithExplanation(highlight: HighlightData, explanation: HighlightExplanationData): void {
  highlight.context = explanation.context
  highlight.explanation = explanation.explanation
  highlight.examples = explanation.examples
  highlight.pronunciation = explanation.pronunciation
  highlight.link = explanation.link
}

/**
 * 复制 prompt 到剪贴板
 */
export async function copyPromptToClipboard(promptExport: HighlightPromptExport): Promise<void> {
  const prompt = generateAIPrompt(promptExport)

  if (!navigator.clipboard) {
    throw new Error('Clipboard API not supported')
  }

  await navigator.clipboard.writeText(prompt)
}

/**
 * 复制 highlights 数据到剪贴板（JSON 格式）
 */
export async function copyHighlightsToClipboard(highlights: HighlightData[]): Promise<void> {
  const data = {
    highlights,
    metadata: {
      timestamp: Date.now(),
      totalCount: highlights.length,
      exportedAt: new Date().toISOString(),
    },
  }

  if (!navigator.clipboard) {
    throw new Error('Clipboard API not supported')
  }

  await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
}

/**
 * 从剪贴板读取解释数据
 */
export async function readExplanationFromClipboard(): Promise<HighlightExplanationData[]> {
  if (!navigator.clipboard) {
    throw new Error('Clipboard API not supported')
  }

  const content = await navigator.clipboard.readText()

  if (!content.trim()) {
    throw new Error('Clipboard is empty')
  }

  try {
    // 尝试解析 JSON
    const data = JSON.parse(content)
    if (Array.isArray(data)) {
      return data
    }
    if (data.explanations && Array.isArray(data.explanations)) {
      return data.explanations
    }
    if (data.highlights && Array.isArray(data.highlights)) {
      // 如果是导出的高亮数据格式，转换为解释格式
      return data.highlights.map((h: HighlightData) => ({
        highlight: h.text,
        context: h.context || h.text,
        explanation: h.explanation || '',
        examples: h.examples || [],
        pronunciation: h.pronunciation || '',
        link: h.link || null,
        id: h.id,
      }))
    }
    throw new Error('Invalid data format')
  }
  catch {
    // 尝试从文本中提取 JSON
    const jsonMatch = content.match(/```json([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1].trim())
        return Array.isArray(jsonData) ? jsonData : jsonData.explanations || []
      }
      catch {
        throw new Error('Failed to parse JSON from markdown code block')
      }
    }

    throw new Error('No valid JSON data found in clipboard')
  }
}

/**
 * 导出为文件下载（保留兼容性）
 */
export function downloadPromptAsFile(promptExport: HighlightPromptExport, filename?: string): void {
  const prompt = generateAIPrompt(promptExport)
  const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || `highlights-prompt-${Date.now()}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * 导出为 JSON 文件（保留兼容性）
 */
export function downloadHighlightsAsJSON(highlights: HighlightData[], filename?: string): void {
  const data = {
    highlights,
    metadata: {
      timestamp: Date.now(),
      totalCount: highlights.length,
      exportedAt: new Date().toISOString(),
    },
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || `highlights-data-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * 从文件读取解释数据
 */
export function readExplanationFile(file: File): Promise<HighlightExplanationData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string

        // 尝试解析 JSON
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content)
          resolve(Array.isArray(data) ? data : data.explanations || [])
          return
        }

        // 尝试从文本中提取 JSON
        const jsonMatch = content.match(/```json([\s\S]*?)```/)
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[1])
          resolve(Array.isArray(jsonData) ? jsonData : jsonData.explanations || [])
          return
        }

        reject(new Error('No valid JSON data found in file'))
      }
      catch (error) {
        reject(new Error(`Failed to parse file: ${error}`))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
